#!/usr/bin/env bash
# Database backup script — pg_dump + gzip, keeps last 7 backups
set -euo pipefail

BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${TIMESTAMP}.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set" >&2
  exit 1
fi

echo "Creating backup: ${FILENAME}..."
pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"
echo "Backup created: ${BACKUP_DIR}/${FILENAME}"

# Keep only last 7 backups
cd "$BACKUP_DIR"
ls -t backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm --
echo "Cleanup done. Keeping last 7 backups."
