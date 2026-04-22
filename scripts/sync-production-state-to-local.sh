#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[state-sync] %s\n' "$*" >&2
}

log "Mirroring production database into local Docker PostgreSQL..."
ACRE_SYNC_RESET_LOCAL=1 bash "$ROOT_DIR/scripts/sync-production-db-to-local.sh"

log "Mirroring production document files into local Docker document storage..."
bash "$ROOT_DIR/scripts/sync-production-documents-to-local.sh"

log "Local state now mirrors production database rows and document files."
