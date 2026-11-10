#!/bin/bash
# Nightly consistent SQLite snapshot (online backup API) + 30-day retention
set -euo pipefail
DB=/var/lib/pilots-logbook/data/logbook.db
DEST=/var/lib/pilots-logbook/backups
STAMP=$(date +%F)
mkdir -p "$DEST"
sqlite3 "$DB" ".backup $DEST/logbook-$STAMP.db"
gzip -f "$DEST/logbook-$STAMP.db"
find "$DEST" -name 'logbook-*.db.gz' -mtime +30 -delete
echo "backup written: $DEST/logbook-$STAMP.db.gz"
