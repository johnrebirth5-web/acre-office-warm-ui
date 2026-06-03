#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEPLOY_HOST="${ACRE_DEPLOY_HOST:-}"
SSH_KEY="${ACRE_DEPLOY_SSH_KEY:-}"
REMOTE_DOCUMENTS_ROOT="${ACRE_REMOTE_DOCUMENTS_STORAGE_ROOT:-}"

LOCAL_WEB_SERVICE="${ACRE_LOCAL_WEB_SERVICE:-web}"
LOCAL_DOCUMENTS_DIR="${ACRE_LOCAL_DOCUMENTS_DIR:-/app/.local-storage/documents}"

TMP_DIR=""

log() {
  printf '[documents-sync] %s\n' "$*" >&2
}

fail() {
  log "$*"
  exit 1
}

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

docker_compose() {
  docker compose -f "$ROOT_DIR/docker-compose.yml" "$@"
}

require_commands() {
  command -v docker >/dev/null 2>&1 || fail "docker is required."
  command -v rsync >/dev/null 2>&1 || fail "rsync is required."
  command -v ssh >/dev/null 2>&1 || fail "ssh is required."
  command -v tar >/dev/null 2>&1 || fail "tar is required."
}

require_remote_sync_config() {
  [ -n "$DEPLOY_HOST" ] || fail "ACRE_DEPLOY_HOST is required."
  [ -n "$SSH_KEY" ] || fail "ACRE_DEPLOY_SSH_KEY is required."
  [ -n "$REMOTE_DOCUMENTS_ROOT" ] || fail "ACRE_REMOTE_DOCUMENTS_STORAGE_ROOT is required."
}

ensure_local_web_running() {
  if ! docker_compose ps --services --status running | grep -qx "$LOCAL_WEB_SERVICE"; then
    log "Local Docker service '$LOCAL_WEB_SERVICE' is not running. Starting it now..."
    docker_compose up -d "$LOCAL_WEB_SERVICE" >/dev/null
  fi
}

stage_remote_documents() {
  TMP_DIR="$(mktemp -d)"
  mkdir -p "$TMP_DIR/documents"

  log "Mirroring remote documents from $DEPLOY_HOST:$REMOTE_DOCUMENTS_ROOT into local temp stage..."
  rsync -az --delete \
    -e "ssh -i \"$SSH_KEY\" -o StrictHostKeyChecking=yes" \
    "$DEPLOY_HOST:$REMOTE_DOCUMENTS_ROOT/" \
    "$TMP_DIR/documents/"
}

replace_local_documents_volume() {
  log "Replacing local documents volume at $LOCAL_DOCUMENTS_DIR..."

  docker_compose exec -T "$LOCAL_WEB_SERVICE" sh -lc \
    "mkdir -p '$LOCAL_DOCUMENTS_DIR' && find '$LOCAL_DOCUMENTS_DIR' -mindepth 1 -delete"

  tar -C "$TMP_DIR/documents" -cf - . \
    | docker_compose exec -T "$LOCAL_WEB_SERVICE" sh -lc "tar -xf - -C '$LOCAL_DOCUMENTS_DIR'"
}

main() {
  trap cleanup EXIT

  require_commands
  require_remote_sync_config
  ensure_local_web_running
  stage_remote_documents
  replace_local_documents_volume

  log "Production documents now mirror the remote source in the local Docker documents volume."
}

main "$@"
