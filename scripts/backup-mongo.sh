#!/usr/bin/env bash
#
# MongoDB Atlas M0 backup (PROJECT_PLAN.md §14.1).
#
# M0 has NO automated backups. The client is hand-entering thousands of
# products at roughly four minutes each — losing that is unrecoverable, so this
# is not optional. Run it on a schedule (cron, a GitHub Action, or any small
# always-on box) and ship the archive somewhere off Atlas.
#
#   MONGODB_URI="mongodb+srv://..." ./scripts/backup-mongo.sh /path/to/backups
#
# Requires mongodump from the MongoDB Database Tools.

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "MONGODB_URI is not set." >&2
  exit 1
fi

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump not found. Install the MongoDB Database Tools." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/isd-arabia-$STAMP.gz"

echo "Dumping to $ARCHIVE"
# --archive + --gzip produces one compressed file rather than a directory tree,
# which is far easier to ship to object storage and to restore from.
mongodump --uri="$MONGODB_URI" --archive="$ARCHIVE" --gzip

# A zero-byte archive means mongodump failed quietly; fail loudly instead so
# the schedule does not silently produce empty backups for weeks.
if [[ ! -s "$ARCHIVE" ]]; then
  echo "Backup is empty — treating as a failure." >&2
  rm -f "$ARCHIVE"
  exit 1
fi

echo "Wrote $(du -h "$ARCHIVE" | cut -f1)"

# Prune old archives. Runs only after a verified-good dump, so a run of
# failures can never delete the last known-good backup.
find "$BACKUP_DIR" -name 'isd-arabia-*.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "Done. Restore with:"
echo "  mongorestore --uri=\"\$MONGODB_URI\" --archive=$ARCHIVE --gzip --drop"
