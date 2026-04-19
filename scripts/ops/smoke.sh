#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="https://acresystem.us/api/health"
LOGIN_URL="https://acresystem.us/login"
JOURNAL_SERVICE="acre-ui-rebuild-web.service"
JOURNAL_WINDOW_MINUTES=5

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/smoke.sh [--health-url URL] [--login-url URL] [--journal-service NAME] [--journal-window MINUTES]

Example:
  bash scripts/ops/smoke.sh --health-url https://acresystem.us/api/health --login-url https://acresystem.us/login --journal-service acre-ui-rebuild-web.service --journal-window 5
EOF
}

OVERALL_STATUS=0

report_ok() {
  printf '[OK] %s\n' "$1"
}

report_fail() {
  printf '[FAIL] %s\n' "$1"
  OVERALL_STATUS=1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --health-url)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      HEALTH_URL="$2"
      shift 2
      ;;
    --login-url)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      LOGIN_URL="$2"
      shift 2
      ;;
    --journal-service)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      JOURNAL_SERVICE="$2"
      shift 2
      ;;
    --journal-window)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      JOURNAL_WINDOW_MINUTES="$2"
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

if ! [[ "$JOURNAL_WINDOW_MINUTES" =~ ^[1-9][0-9]*$ ]]; then
  printf '[FAIL] --journal-window must be a positive integer\n' >&2
  exit 1
fi

for required_command in curl journalctl grep sed; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    printf '[FAIL] required command is missing: %s\n' "$required_command" >&2
    exit 1
  fi
done

health_tmp="$(mktemp)"
journal_tmp="$(mktemp)"

cleanup() {
  rm -f "$health_tmp" "$journal_tmp"
}

trap cleanup EXIT

if health_code="$(curl -sS --max-time 5 -o "$health_tmp" -w '%{http_code}' "$HEALTH_URL" 2>/dev/null)"; then
  if [[ "$health_code" == "200" ]]; then
    health_status="$(tr -d '\r\n' < "$health_tmp" | sed -n 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
    if [[ "$health_status" == "ok" ]]; then
      report_ok "health endpoint returned HTTP 200 with status ok"
    else
      report_fail "health endpoint returned HTTP 200 with status ${health_status:-missing}"
    fi
  else
    report_fail "health endpoint returned HTTP $health_code"
  fi
else
  report_fail "health endpoint probe failed: $HEALTH_URL"
fi

if login_code="$(curl -fsSI --max-time 5 -o /dev/null -w '%{http_code}' "$LOGIN_URL" 2>/dev/null)"; then
  if [[ "$login_code" =~ ^[23] ]]; then
    report_ok "login endpoint returned HTTP $login_code"
  else
    report_fail "login endpoint returned HTTP $login_code"
  fi
else
  report_fail "login endpoint probe failed: $LOGIN_URL"
fi

if journalctl -u "$JOURNAL_SERVICE" --since "$JOURNAL_WINDOW_MINUTES minutes ago" --no-pager >"$journal_tmp" 2>/dev/null; then
  journal_patterns=(
    "invalid session signature|invalid session signature"
    "DB auth failure|DB auth failure"
    "Resend auth failure|Resend auth failure"
    "prisma.*P1000|prisma.*P1000"
    "prisma.*P1001|prisma.*P1001"
    "ECONNREFUSED|ECONNREFUSED"
  )

  for entry in "${journal_patterns[@]}"; do
    label="${entry%%|*}"
    pattern="${entry#*|}"
    count="$(grep -Eic "$pattern" "$journal_tmp" || true)"
    if [[ "$count" == "0" ]]; then
      report_ok "journal pattern \"$label\" matched 0 lines in last $JOURNAL_WINDOW_MINUTES minutes"
    else
      report_fail "journal pattern \"$label\" matched $count lines in last $JOURNAL_WINDOW_MINUTES minutes"
    fi
  done
else
  report_fail "journal scan failed for service $JOURNAL_SERVICE"
fi

if [[ "$OVERALL_STATUS" -eq 0 ]]; then
  printf 'PASS\n'
  exit 0
fi

printf 'FAIL\n'
exit 1
