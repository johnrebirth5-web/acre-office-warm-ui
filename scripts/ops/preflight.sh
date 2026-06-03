#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=""
SERVICE_NAME=""
HEALTH_URL=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/preflight.sh [--env-file PATH] [--service NAME] [--health-url URL]

Example:
  bash scripts/ops/preflight.sh --env-file <deployment-env-file> --service <app-service-name> --health-url https://your-acre-domain.example.com/api/health
EOF
}

trim_whitespace() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

normalize_env_value() {
  local value
  value="$(trim_whitespace "$1")"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value#\"}"
    value="${value%\"}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value#\'}"
    value="${value%\'}"
  fi
  printf '%s' "$value"
}

read_env_value() {
  local key="$1"
  awk -v key="$key" '
    /^[[:space:]]*#/ { next }
    {
      line = $0
      sub(/\r$/, "", line)
      if (match(line, "^[[:space:]]*" key "[[:space:]]*=")) {
        sub("^[[:space:]]*" key "[[:space:]]*=[[:space:]]*", "", line)
        value = line
        found = 1
      }
    }
    END {
      if (found) {
        print value
      } else {
        exit 1
      }
    }
  ' "$ENV_FILE"
}

OVERALL_STATUS=0

report_ok() {
  printf '[OK] %s\n' "$1"
}

report_warn() {
  printf '[WARN] %s\n' "$1"
}

report_fail() {
  printf '[FAIL] %s\n' "$1"
  OVERALL_STATUS=1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    --service)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      SERVICE_NAME="$2"
      shift 2
      ;;
    --health-url)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      HEALTH_URL="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_FILE" || -z "$SERVICE_NAME" || -z "$HEALTH_URL" ]]; then
  usage
  exit 1
fi

if [[ -r "$ENV_FILE" ]]; then
  report_ok "env file is readable: $ENV_FILE"
else
  report_fail "env file is missing or unreadable: $ENV_FILE"
fi

required_keys=(
  "ACRE_SESSION_SECRET"
  "ACRE_RESEND_API_KEY"
  "DATABASE_URL"
  "ACRE_SETTINGS_ENCRYPTION_SECRET"
)

for key in "${required_keys[@]}"; do
  if raw_value="$(read_env_value "$key" 2>/dev/null)"; then
    value="$(normalize_env_value "$raw_value")"
    if [[ -n "$value" ]]; then
      report_ok "$key is present and non-empty"
    else
      report_fail "$key is present but empty"
    fi
  else
    report_fail "$key is missing"
  fi
done

if raw_secondary="$(read_env_value "ACRE_SESSION_SECRET_SECONDARY" 2>/dev/null)"; then
  secondary_value="$(normalize_env_value "$raw_secondary")"
  if [[ -n "$secondary_value" ]]; then
    report_fail "ACRE_SESSION_SECRET_SECONDARY must be empty or absent"
  else
    report_ok "ACRE_SESSION_SECRET_SECONDARY is empty"
  fi
else
  report_ok "ACRE_SESSION_SECRET_SECONDARY is absent"
fi

service_state="$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || true)"
if [[ "$service_state" == "active" ]]; then
  report_ok "systemd service is active: $SERVICE_NAME"
else
  report_fail "systemd service is not active: $SERVICE_NAME"
fi

health_tmp="$(mktemp)"
cleanup() {
  rm -f "$health_tmp"
}
trap cleanup EXIT

if http_code="$(curl -fsS --max-time 5 -o "$health_tmp" -w '%{http_code}' "$HEALTH_URL" 2>/dev/null)"; then
  if [[ "$http_code" == "200" ]]; then
    health_json="$(tr -d '\r\n' < "$health_tmp")"
    health_status="$(printf '%s' "$health_json" | sed -n 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
    case "$health_status" in
      ok)
        report_ok "health endpoint returned HTTP 200 with status ok"
        ;;
      degraded)
        report_warn "health endpoint returned HTTP 200 with status degraded"
        ;;
      *)
        report_fail "health endpoint returned HTTP 200 with unsupported status"
        ;;
    esac
  else
    report_fail "health endpoint returned HTTP $http_code"
  fi
else
  report_fail "health endpoint probe failed: $HEALTH_URL"
fi

if [[ "$OVERALL_STATUS" -eq 0 ]]; then
  printf 'GO\n'
  exit 0
fi

printf 'NO-GO\n'
exit 1
