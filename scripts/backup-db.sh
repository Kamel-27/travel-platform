#!/usr/bin/env bash
#
# TravelHub — PostgreSQL backup.
#
# Dumps the production database out of the Postgres container to a timestamped
# file on the VM, prunes dumps older than RETENTION_DAYS, and fails loudly if
# anything goes wrong (so cron emails you / the exit code is visible).
#
# Usage (from the repo root on the VM):
#   ./scripts/backup-db.sh
#
# Cron — nightly at 03:15, appending to a log:
#   15 3 * * * cd ~/travel-platform && ./scripts/backup-db.sh >> ~/backup.log 2>&1
#
# IMPORTANT: dumps land on the SAME VM as the database. That protects you from
# a bad migration or an accidental DELETE, but NOT from losing the VM or its
# disk. Copying them off-box is the step that makes this a real backup — see
# the OFF-SITE COPY section at the bottom of this file.
#
# Restoring is documented in docs/deployment.md § Database backups.

set -euo pipefail

# ── Config (override via environment) ────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PG_SERVICE="${PG_SERVICE:-postgres}"
PG_USER="${PG_USER:-travelhub}"
PG_DB="${PG_DB:-travelhub}"

# A dump smaller than this almost certainly means pg_dump failed partway and
# still exited 0 (e.g. the container died mid-stream). Treat it as a failure.
MIN_BYTES="${MIN_BYTES:-10240}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
outfile="${BACKUP_DIR}/travelhub-${timestamp}.dump"

log() { printf '%s  %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE (run from the repo root)"
command -v docker >/dev/null 2>&1 || fail "docker not on PATH"

mkdir -p "$BACKUP_DIR"

# ── Dump ─────────────────────────────────────────────────────────────
# -Fc  custom format: compressed, and restorable selectively with pg_restore
# -T   no TTY, required under cron
log "dumping ${PG_DB} -> ${outfile}"

if ! docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
  pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$outfile"; then
  rm -f "$outfile"
  fail "pg_dump failed — no backup written"
fi

# ── Verify ───────────────────────────────────────────────────────────
size="$(wc -c < "$outfile" | tr -d ' ')"
if [ "$size" -lt "$MIN_BYTES" ]; then
  rm -f "$outfile"
  fail "dump was only ${size} bytes (< ${MIN_BYTES}) — treating as a failed backup"
fi

# pg_restore --list reads the archive's table of contents; if it parses, the
# file is a structurally valid dump rather than a truncated stream.
if ! docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
  pg_restore --list /dev/stdin < "$outfile" > /dev/null 2>&1; then
  fail "dump at ${outfile} is not a readable pg_dump archive — kept for inspection"
fi

log "ok — ${size} bytes, archive verified"

# ── Prune old dumps ──────────────────────────────────────────────────
pruned="$(find "$BACKUP_DIR" -name 'travelhub-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
log "pruned ${pruned} dump(s) older than ${RETENTION_DAYS} days"

remaining="$(find "$BACKUP_DIR" -name 'travelhub-*.dump' -type f | wc -l | tr -d ' ')"
log "done — ${remaining} dump(s) in ${BACKUP_DIR}"

# ── OFF-SITE COPY ────────────────────────────────────────────────────
# Uncomment ONE of these once you've picked a destination and configured its
# credentials on the VM. Until then, a dead VM still means total data loss.
#
# Azure Blob Storage (az login / managed identity required):
#   az storage blob upload --account-name "$AZ_ACCOUNT" --container-name backups \
#     --file "$outfile" --name "$(basename "$outfile")" --auth-mode login
#
# Any S3-compatible bucket via rclone (rclone config first):
#   rclone copy "$outfile" "remote:travelhub-backups/"
#
# Cheapest option — pull to your own machine on a schedule instead of pushing:
#   rsync -avz vm:~/backups/postgres/ ~/travelhub-backups/
