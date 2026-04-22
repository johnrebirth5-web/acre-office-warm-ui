#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEPLOY_HOST="${ACRE_DEPLOY_HOST:-root@45.55.247.137}"
SSH_KEY="${ACRE_DEPLOY_SSH_KEY:-$HOME/.ssh/acre_do_ed25519}"
ENV_FILE="${ACRE_DEPLOY_ENV_FILE:-/etc/acre/acre-ui-rebuild.env}"

LOCAL_DB_SERVICE="${ACRE_LOCAL_DB_SERVICE:-db}"
LOCAL_DB_HOST="${ACRE_LOCAL_DB_HOST:-127.0.0.1}"
LOCAL_DB_NAME="${ACRE_LOCAL_DB_NAME:-acre}"
LOCAL_DB_USER="${ACRE_LOCAL_DB_USER:-postgres}"
LOCAL_DB_PASSWORD="${ACRE_LOCAL_DB_PASSWORD:-postgres}"

STAGE_SCHEMA="${ACRE_SYNC_STAGE_SCHEMA:-prod_sync_stage}"
KEEP_STAGE_SCHEMA="${ACRE_SYNC_KEEP_STAGE_SCHEMA:-0}"
RESET_LOCAL="${ACRE_SYNC_RESET_LOCAL:-0}"

log() {
  printf '[db-sync] %s\n' "$*" >&2
}

fail() {
  log "$*"
  exit 1
}

validate_identifier() {
  local value="$1"

  if [[ ! "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    fail "Invalid SQL identifier: $value"
  fi
}

docker_compose() {
  docker compose -f "$ROOT_DIR/docker-compose.yml" "$@"
}

run_local_psql() {
  docker_compose exec -T "$LOCAL_DB_SERVICE" env PGPASSWORD="$LOCAL_DB_PASSWORD" \
    psql -h "$LOCAL_DB_HOST" -v ON_ERROR_STOP=1 -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" "$@"
}

run_local_query() {
  docker_compose exec -T "$LOCAL_DB_SERVICE" env PGPASSWORD="$LOCAL_DB_PASSWORD" \
    psql -h "$LOCAL_DB_HOST" -At -v ON_ERROR_STOP=1 -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "$1" </dev/null
}

require_commands() {
  command -v docker >/dev/null 2>&1 || fail "docker is required."
  command -v ssh >/dev/null 2>&1 || fail "ssh is required."
  command -v perl >/dev/null 2>&1 || fail "perl is required."
}

ensure_local_db_running() {
  if ! docker_compose ps --services --status running | grep -qx "$LOCAL_DB_SERVICE"; then
    fail "Local Docker database service '$LOCAL_DB_SERVICE' is not running. Start it with 'npm run docker:dev:up'."
  fi
}

prepare_stage_schema() {
  log "Preparing local stage schema '$STAGE_SCHEMA'..."

  cat <<SQL | run_local_psql
DROP SCHEMA IF EXISTS "$STAGE_SCHEMA" CASCADE;
CREATE SCHEMA "$STAGE_SCHEMA";

DO \$\$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  LOOP
    EXECUTE format('CREATE TABLE %I.%I AS TABLE public.%I WITH NO DATA;', '$STAGE_SCHEMA', table_record.tablename, table_record.tablename);
  END LOOP;
END
\$\$;
SQL
}

import_remote_dump_into_stage() {
  log "Streaming a read-only production dump into local stage schema '$STAGE_SCHEMA'..."

  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=yes "$DEPLOY_HOST" "ENV_FILE='$ENV_FILE' bash -s" <<'REMOTE' \
    | STAGE_SCHEMA="$STAGE_SCHEMA" perl -ne '
        BEGIN {
          $schema = $ENV{STAGE_SCHEMA};
        }
        next if /^SELECT pg_catalog\.setval/;
        s/^(INSERT INTO )public\./${1}${schema}./;
        print;
      ' \
    | run_local_psql
set -euo pipefail

set -a
. "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL was not found in $ENV_FILE" >&2
  exit 1
fi

exec pg_dump "$DATABASE_URL" \
  --data-only \
  --column-inserts \
  --rows-per-insert=200 \
  --no-owner \
  --no-privileges \
  --exclude-table=public._prisma_migrations
REMOTE
}

maybe_reset_local_public_schema() {
  if [ "$RESET_LOCAL" != "1" ]; then
    return
  fi

  log "Resetting local public data before merge because ACRE_SYNC_RESET_LOCAL=1..."

  cat <<'SQL' | run_local_psql
BEGIN;
SET LOCAL session_replication_role = replica;

DO $$
DECLARE
  table_list text;
BEGIN
  SELECT string_agg(format('public.%I', tablename), ', ' ORDER BY tablename)
  INTO table_list
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';

  IF table_list IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
  END IF;
END
$$;

COMMIT;
SQL
}

append_merge_statements() {
  local merge_file="$1"
  local tables

  tables="$(run_local_query "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename;")"

  printf 'BEGIN;\nSET LOCAL session_replication_role = replica;\n' >"$merge_file"

  while IFS= read -r table; do
    [ -n "$table" ] || continue
    validate_identifier "$table"

    local pk_columns
    local all_columns
    local update_columns

    pk_columns="$(run_local_query "
      SELECT string_agg(format('%I', a.attname), ', ' ORDER BY x.ordinality)
      FROM pg_index i
      JOIN unnest(i.indkey) WITH ORDINALITY AS x(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = x.attnum
      WHERE i.indrelid = format('public.%I', '$table')::regclass
        AND i.indisprimary;
    ")"

    [ -n "$pk_columns" ] || fail "Table '$table' does not have a primary key, so it cannot be merged safely."

    all_columns="$(run_local_query "
      SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '$table';
    ")"

    update_columns="$(run_local_query "
      WITH pk_columns AS (
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN unnest(i.indkey) WITH ORDINALITY AS x(attnum, ordinality) ON true
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = x.attnum
        WHERE i.indrelid = format('public.%I', '$table')::regclass
          AND i.indisprimary
      )
      SELECT string_agg(format('%1\$I = EXCLUDED.%1\$I', c.column_name), ', ' ORDER BY c.ordinal_position)
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = '$table'
        AND NOT EXISTS (
          SELECT 1
          FROM pk_columns pk
          WHERE pk.column_name = c.column_name
        );
    ")"

    if [ -n "$update_columns" ]; then
      printf 'INSERT INTO public."%s" (%s) SELECT %s FROM "%s"."%s" ON CONFLICT (%s) DO UPDATE SET %s;\n' \
        "$table" \
        "$all_columns" \
        "$all_columns" \
        "$STAGE_SCHEMA" \
        "$table" \
        "$pk_columns" \
        "$update_columns" >>"$merge_file"
    else
      printf 'INSERT INTO public."%s" (%s) SELECT %s FROM "%s"."%s" ON CONFLICT (%s) DO NOTHING;\n' \
        "$table" \
        "$all_columns" \
        "$all_columns" \
        "$STAGE_SCHEMA" \
        "$table" \
        "$pk_columns" >>"$merge_file"
    fi
  done <<<"$tables"

  run_local_query "
    SELECT format(
      'SELECT CASE WHEN MAX(%1\$I) IS NULL THEN setval(%2\$L, 1, false) ELSE setval(%2\$L, MAX(%1\$I), true) END FROM public.%3\$I;',
      column_name,
      pg_get_serial_sequence(format('public.%I', table_name), column_name),
      table_name
    )
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name <> '_prisma_migrations'
      AND pg_get_serial_sequence(format('public.%I', table_name), column_name) IS NOT NULL
    ORDER BY table_name, ordinal_position;
  " >>"$merge_file"

  printf 'COMMIT;\n' >>"$merge_file"
}

merge_stage_into_local() {
  local merge_file

  merge_file="$(mktemp)"
  append_merge_statements "$merge_file"

  log "Merging staged production rows into local public schema..."
  run_local_psql <"$merge_file"
  rm -f "$merge_file"
}

cleanup_stage_schema() {
  if [ "$KEEP_STAGE_SCHEMA" = "1" ]; then
    log "Keeping stage schema '$STAGE_SCHEMA' because ACRE_SYNC_KEEP_STAGE_SCHEMA=1."
    return
  fi

  log "Dropping local stage schema '$STAGE_SCHEMA'..."
  printf 'DROP SCHEMA IF EXISTS "%s" CASCADE;\n' "$STAGE_SCHEMA" | run_local_psql
}

main() {
  require_commands
  validate_identifier "$LOCAL_DB_SERVICE"
  validate_identifier "$LOCAL_DB_NAME"
  validate_identifier "$LOCAL_DB_USER"
  validate_identifier "$STAGE_SCHEMA"
  ensure_local_db_running
  prepare_stage_schema
  import_remote_dump_into_stage
  maybe_reset_local_public_schema
  merge_stage_into_local
  cleanup_stage_schema

  if [ "$RESET_LOCAL" = "1" ]; then
    log "Production-to-local mirror completed. Production stayed read-only, and the local public schema now mirrors production rows."
    return
  fi

  log "Production-to-local sync completed. Production stayed read-only, and local-only rows were preserved."
}

main "$@"
