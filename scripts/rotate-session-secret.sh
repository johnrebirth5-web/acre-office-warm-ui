#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${ACRE_DEPLOY_ENV_FILE:-}"
SERVICE_NAME="${ACRE_DEPLOY_SERVICE:-}"
DRY_RUN=1
FORCE_OVERWRITE_SECONDARY=0
SESSION_COMPATIBILITY_WINDOW_DAYS=30

usage() {
  cat <<'EOF'
Usage:
  bash ./scripts/rotate-session-secret.sh [--apply] [--env-file <path>] [--service <name>] [--force-overwrite-secondary]

Behavior:
  - Dry-run is enabled by default.
  - In dry-run mode, the script never generates or prints a real replacement secret.
  - In apply mode, the script generates a new ACRE_SESSION_SECRET, moves the current
    primary value into ACRE_SESSION_SECRET_SECONDARY, writes the updated env file,
    creates a timestamped backup, and restarts the configured service.

Options:
  --apply                      Execute the rotation. Without this flag the script only previews work.
  --env-file <path>            Target environment file path.
  --service <name>             Target service name for restart.
  --force-overwrite-secondary  Replace an existing ACRE_SESSION_SECRET_SECONDARY value.
  --help                       Show this help message.
EOF
}

log() {
  printf '[rotate-session-secret] %s\n' "$*"
}

fail() {
  printf '[rotate-session-secret] ERROR: %s\n' "$*" >&2
  exit 1
}

mask_secret() {
  local value="$1"
  local length="${#value}"

  if [ "$length" -eq 0 ]; then
    printf '<empty>'
    return 0
  fi

  printf '<redacted len=%s>' "$length"
}

strip_wrapping_quotes() {
  local value="$1"

  if [ "${#value}" -ge 2 ]; then
    case "$value" in
      \"*\")
        value="${value#\"}"
        value="${value%\"}"
        ;;
      \'*\')
        value="${value#\'}"
        value="${value%\'}"
        ;;
    esac
  fi

  printf '%s' "$value"
}

read_env_value() {
  local key="$1"
  local raw

  raw="$(
    awk -v key="$key" '
      index($0, key "=") == 1 {
        value = substr($0, length(key) + 2)
      }
      END {
        if (length(value) > 0) {
          print value
        }
      }
    ' "$ENV_FILE"
  )"

  if [ -z "${raw:-}" ]; then
    return 1
  fi

  strip_wrapping_quotes "$raw"
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
from secrets import token_hex

print(token_hex(32))
PY
    return 0
  fi

  fail "Neither openssl nor python3 is available to generate a new session secret."
}

build_updated_env_file() {
  local destination="$1"
  local new_secret="$2"
  local previous_secret="$3"

  awk \
    -v new_secret="$new_secret" \
    -v previous_secret="$previous_secret" \
    '
      BEGIN {
        primary_written = 0
        secondary_written = 0
      }
      /^ACRE_SESSION_SECRET=/ {
        if (!primary_written) {
          printf "ACRE_SESSION_SECRET=\"%s\"\n", new_secret
          primary_written = 1
        }
        next
      }
      /^ACRE_SESSION_SECRET_SECONDARY=/ {
        if (!secondary_written) {
          printf "ACRE_SESSION_SECRET_SECONDARY=\"%s\"\n", previous_secret
          secondary_written = 1
        }
        next
      }
      {
        print
      }
      END {
        if (!primary_written) {
          printf "ACRE_SESSION_SECRET=\"%s\"\n", new_secret
        }
        if (!secondary_written) {
          printf "ACRE_SESSION_SECRET_SECONDARY=\"%s\"\n", previous_secret
        }
      }
    ' "$ENV_FILE" >"$destination"
}

require_apply_prerequisites() {
  [ -f "$ENV_FILE" ] || fail "Environment file not found: $ENV_FILE"
  [ -w "$ENV_FILE" ] || fail "Environment file is not writable: $ENV_FILE"
  command -v systemctl >/dev/null 2>&1 || fail "systemctl is required in apply mode."
  [ -n "$SERVICE_NAME" ] || fail "A service name is required in apply mode. Use --service or ACRE_DEPLOY_SERVICE."
}

main() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --apply)
        DRY_RUN=0
        shift
        ;;
      --env-file)
        [ "$#" -ge 2 ] || fail "--env-file requires a value."
        ENV_FILE="$2"
        shift 2
        ;;
      --service)
        [ "$#" -ge 2 ] || fail "--service requires a value."
        SERVICE_NAME="$2"
        shift 2
        ;;
      --force-overwrite-secondary)
        FORCE_OVERWRITE_SECONDARY=1
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done

  [ -n "$ENV_FILE" ] || fail "An environment file is required. Use --env-file or ACRE_DEPLOY_ENV_FILE."
  [ -f "$ENV_FILE" ] || fail "Environment file not found: $ENV_FILE"

  local current_primary=""
  local current_secondary=""
  local backup_path
  local timestamp

  current_primary="$(read_env_value "ACRE_SESSION_SECRET" || true)"
  current_secondary="$(read_env_value "ACRE_SESSION_SECRET_SECONDARY" || true)"

  [ -n "$current_primary" ] || fail "ACRE_SESSION_SECRET is missing from $ENV_FILE"

  if [ -n "$current_secondary" ] && [ "$FORCE_OVERWRITE_SECONDARY" -ne 1 ]; then
    fail "ACRE_SESSION_SECRET_SECONDARY is already populated. Clear it after the current compatibility window or rerun with --force-overwrite-secondary."
  fi

  timestamp="$(date '+%Y%m%d-%H%M%S')"
  backup_path="${ENV_FILE}.bak.${timestamp}"

  log "Mode: $( [ "$DRY_RUN" -eq 1 ] && printf 'dry-run' || printf 'apply' )"
  log "Environment file: $ENV_FILE"
  log "Service: $SERVICE_NAME"
  log "Current primary: $(mask_secret "$current_primary")"
  log "Current secondary: $(mask_secret "$current_secondary")"
  log "Compatibility window: keep ACRE_SESSION_SECRET_SECONDARY for ${SESSION_COMPATIBILITY_WINDOW_DAYS} days before removal."
  log "This script never prints the generated replacement secret."

  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] Would create backup: $backup_path"
    log "[dry-run] Would write a new generated ACRE_SESSION_SECRET."
    log "[dry-run] Would move the current primary value into ACRE_SESSION_SECRET_SECONDARY."
    if [ -n "$SERVICE_NAME" ]; then
      log "[dry-run] Would restart service: $SERVICE_NAME"
    else
      log "[dry-run] No service restart would be attempted because no service name was provided."
    fi
    exit 0
  fi

  require_apply_prerequisites

  local new_primary=""
  local temp_file=""

  new_primary="$(generate_secret)"
  [ -n "$new_primary" ] || fail "Generated session secret is empty."

  temp_file="$(mktemp)"
  trap 'rm -f "$temp_file"' EXIT

  build_updated_env_file "$temp_file" "$new_primary" "$current_primary"
  cp "$ENV_FILE" "$backup_path"
  cat "$temp_file" >"$ENV_FILE"

  log "Backup created at: $backup_path"
  systemctl restart "$SERVICE_NAME"
  log "Restarted service: $SERVICE_NAME"
  log "Rotation applied. Keep ACRE_SESSION_SECRET_SECONDARY until the compatibility window has elapsed."
}

main "$@"
