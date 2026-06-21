#!/usr/bin/env bash
# Konsistentes Backup der SQLite-Datenbank. Per cron täglich aufrufen.
# Voraussetzung: sqlite3-CLI installiert (apt install sqlite3)
set -euo pipefail

DB="${DB_PATH:-/opt/dreicount/data/dreicount.db}"
DEST="/opt/dreicount/backups"
KEEP=14   # so viele Backups behalten

mkdir -p "$DEST"
STAMP="$(date +%F_%H%M)"

# .backup erzeugt einen konsistenten Snapshot, auch während die App läuft
sqlite3 "$DB" ".backup '$DEST/dreicount-$STAMP.db'"
gzip -f "$DEST/dreicount-$STAMP.db"

# Alte Backups aufräumen
ls -1t "$DEST"/dreicount-*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "Backup erstellt: $DEST/dreicount-$STAMP.db.gz"
