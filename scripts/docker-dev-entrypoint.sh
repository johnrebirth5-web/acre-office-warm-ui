#!/bin/sh
set -eu

cd /app

STAMP_FILE="node_modules/.package-lock.hash"
LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
NEEDS_INSTALL=0

if [ ! -x node_modules/.bin/next ]; then
  NEEDS_INSTALL=1
elif [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE")" != "$LOCK_HASH" ]; then
  NEEDS_INSTALL=1
fi

if [ "$NEEDS_INSTALL" -eq 1 ]; then
  echo "[docker-dev] Installing npm dependencies..."
  npm ci
  mkdir -p node_modules
  printf '%s' "$LOCK_HASH" > "$STAMP_FILE"
fi

echo "[docker-dev] Generating Prisma client..."
npm run db:generate

exec "$@"
