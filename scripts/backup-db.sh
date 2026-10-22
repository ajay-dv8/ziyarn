#!/usr/bin/env bash
#
# Create a compressed, validated PostgreSQL custom-format dump of DATABASE_URL.
#
# Usage:
#   DATABASE_URL='postgresql://...' scripts/backup-db.sh
#   BACKUP_DIR=/secure/path DATABASE_URL='...' scripts/backup-db.sh
#
# The dump is written with mode 600. It contains production data, so never
# commit it or attach it to a public release.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  printf 'DATABASE_URL is required.\n' >&2
  exit 1
fi

for command_name in pg_dump pg_restore; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s is required. Install the PostgreSQL 18 client.\n' "$command_name" >&2
    exit 1
  fi
done

backup_dir="${BACKUP_DIR:-backups}"
mkdir -p "$backup_dir"
umask 077

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_file="${backup_dir%/}/ziyarn-${timestamp}.dump"

cleanup_partial() {
  if [ -f "$output_file" ]; then
    rm -f "$output_file"
  fi
}
trap cleanup_partial ERR

printf 'Creating dump: %s\n' "$output_file"
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --lock-wait-timeout=30s \
  --file="$output_file" \
  "$DATABASE_URL"

if [ ! -s "$output_file" ]; then
  printf 'Backup file is empty.\n' >&2
  exit 1
fi

# A custom-format dump is only useful if pg_restore can read its table of
# contents. This catches a truncated upload/download before it is needed.
pg_restore --list "$output_file" >/dev/null

trap - ERR
byte_count="$(wc -c < "$output_file")"
printf 'Backup validated: %s (%s bytes)\n' "$output_file" "$byte_count"
