#!/usr/bin/env bash
# rebuild.sh — deploy static frontend to /var/www/html/denizsincar.ru/web_midi_streamer
#
# What it does:
#   • Copies every static frontend file (HTML, CSS, JS, assets, SW, manifest)
#   • Skips the signaler/ directory entirely — restart it manually
#   • Skips node_modules, .git, scripts/, tests/, *.sh, *.md, *.php, *.py
#
# Usage:
#   ./rebuild.sh              — deploy to default target
#   ./rebuild.sh /other/path  — deploy to a custom target

set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-/var/www/html/denizsincar.ru/web_midi_streamer}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}==> web_midi_streamer rebuild${NC}"
echo    "    src : $SRC"
echo    "    dest: $DEST"
echo

# ── Preflight ──────────────────────────────────────────────────────────────────
if [[ ! -f "$SRC/index.html" ]]; then
    echo -e "${RED}ERROR: run this script from the repo root (index.html not found)${NC}"
    exit 1
fi

# Create dest if needed (requires sudo if /var/www is root-owned)
if [[ ! -d "$DEST" ]]; then
    echo -e "${YELLOW}  creating $DEST${NC}"
    mkdir -p "$DEST"
fi

# ── Copy static files with rsync ───────────────────────────────────────────────
# --checksum        only copy when content differs (no unnecessary mtime updates)
# --delete          remove stale files from dest that are gone from src
# --exclude         skip everything that isn't pure frontend

rsync -av --checksum --delete \
    --exclude='signaler/'        \
    --exclude='node_modules/'    \
    --exclude='.git/'            \
    --exclude='scripts/'         \
    --exclude='tests/'           \
    --exclude='test-results/'    \
    --exclude='*.sh'             \
    --exclude='*.md'             \
    --exclude='*.php'            \
    --exclude='*.py'             \
    --exclude='chimes.json'      \
    --exclude='*.json.example'   \
    --exclude='*.bak'            \
    --exclude='package.json'     \
    --exclude='package-lock.json'\
    "$SRC/" "$DEST/"

echo
echo -e "${GREEN}==> Done.${NC}"
echo -e "${YELLOW}    Signaler was NOT touched — restart it manually if needed.${NC}"
echo    "    e.g.:  sudo systemctl restart midi-signaler"
echo    "    or:    cd $DEST/signaler && pm2 restart midi-signaler"
