#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_INTERVAL="${ACRE_DEV_KEEPALIVE_INTERVAL:-20}"
HEALTH_URL="${ACRE_DEV_KEEPALIVE_URL:-http://localhost:3105/login}"
TUNNEL_ENABLED="${ACRE_DO_DB_TUNNEL_ENABLED:-1}"
TUNNEL_SOCKET="${ACRE_DO_DB_TUNNEL_SOCKET:-$HOME/.ssh/acre-do-db-tunnel.sock}"
TUNNEL_TARGET="${ACRE_DO_DB_TUNNEL_TARGET:-root@45.55.247.137}"
TUNNEL_KEY="${ACRE_DO_DB_TUNNEL_KEY:-$HOME/.ssh/acre_do_ed25519}"
TUNNEL_LOCAL_PORT="${ACRE_DO_DB_TUNNEL_LOCAL_PORT:-15432}"
TUNNEL_REMOTE_HOST="${ACRE_DO_DB_TUNNEL_REMOTE_HOST:-127.0.0.1}"
TUNNEL_REMOTE_PORT="${ACRE_DO_DB_TUNNEL_REMOTE_PORT:-5432}"
SSH_ARGS=()

if [ -n "${TUNNEL_KEY:-}" ] && [ -f "$TUNNEL_KEY" ]; then
  SSH_ARGS+=(-i "$TUNNEL_KEY")
fi

log() {
  printf '[docker-dev-keepalive] %s\n' "$*"
}

ensure_tunnel() {
  if [ "$TUNNEL_ENABLED" != "1" ]; then
    return
  fi

  if ssh "${SSH_ARGS[@]}" -S "$TUNNEL_SOCKET" -O check "$TUNNEL_TARGET" >/dev/null 2>&1; then
    return
  fi

  mkdir -p "$(dirname "$TUNNEL_SOCKET")"
  log "Starting DO database tunnel on localhost:${TUNNEL_LOCAL_PORT}..."
  ssh "${SSH_ARGS[@]}" -M -S "$TUNNEL_SOCKET" -fnNT \
    -o BatchMode=yes \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -L "${TUNNEL_LOCAL_PORT}:${TUNNEL_REMOTE_HOST}:${TUNNEL_REMOTE_PORT}" \
    "$TUNNEL_TARGET"
}

ensure_compose_running() {
  docker compose up -d >/dev/null
}

ensure_web_responding() {
  local http_code
  http_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)"

  if [ -n "$http_code" ] && [ "$http_code" != "000" ]; then
    return
  fi

  log "Local dev web health check failed; restarting web container..."
  docker compose restart web >/dev/null
}

run_once() {
  ensure_tunnel
  ensure_compose_running
  ensure_web_responding
}

trap 'log "Stopping keepalive loop."; exit 0' INT TERM

log "Watching Docker dev + DO DB tunnel every ${CHECK_INTERVAL}s"
while true; do
  run_once
  sleep "$CHECK_INTERVAL"
done
