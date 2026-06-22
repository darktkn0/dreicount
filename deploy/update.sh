#!/usr/bin/env bash
# Holt den aktuellen master-Stand und baut den Container neu.
# Wird vom GitHub-Actions-Workflow per SSH aufgerufen, lässt sich
# aber genauso von Hand auf der VPS ausführen:  bash deploy/update.sh
set -euo pipefail

# Verzeichnis dieses Skripts -> Projektwurzel (deploy/ liegt unter der Wurzel)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

echo "==> Aktuellen Stand von origin/master holen"
git fetch --prune origin
git reset --hard origin/master

echo "==> Image neu bauen & Container starten"
docker compose up -d --build

echo "==> Alte, ungenutzte Images aufräumen"
docker image prune -f

echo "==> Status"
docker compose ps
