#!/usr/bin/env bash
# rename.sh — migrate web_midi_streamer → jamrtc on the server
#
# What it does:
#   1. Deploys the new JamRTC app to /var/www/html/denizsincar.ru/jamrtc/
#   2. Nukes stale assets from the OLD service worker cache
#      by dropping a tombstone service-worker.js into web_midi_streamer/
#      that unregisters itself and clears all its caches immediately.
#   3. Replaces web_midi_streamer/ with a tiny "Moved Permanently" redirect
#      page (HTTP 301 via meta-refresh + JS) pointing to /jamrtc/.
#   4. Updates the rebuild.sh target from web_midi_streamer → jamrtc.
#
# Usage:
#   sudo bash rename.sh
#   sudo bash rename.sh /var/www/html/denizsincar.ru   # custom webroot

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

WEBROOT="${1:-/var/www/html/denizsincar.ru}"
OLD_DIR="$WEBROOT/web_midi_streamer"
NEW_DIR="$WEBROOT/jamrtc"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${GREEN}==> JamRTC rename migration${NC}"
echo    "    webroot : $WEBROOT"
echo    "    old     : $OLD_DIR"
echo    "    new     : $NEW_DIR"
echo

# ── Step 1: Copy server-only config from old location ─────────────────────────
# These files are gitignored and never in the repo — they only exist on the server.
# We must carry them over BEFORE rsync runs so they land in the new location.
echo -e "${GREEN}--> Step 1: Copy server-only config from $OLD_DIR → $NEW_DIR${NC}"
mkdir -p "$NEW_DIR"

# Files that live on the server but are never committed to git:
SERVER_ONLY_FILES=(
    "config.php"        # TURN server credentials (gitignored)
    "chimes.json"       # Custom chime sounds (excluded from rsync)
)

if [[ -d "$OLD_DIR" ]]; then
    for f in "${SERVER_ONLY_FILES[@]}"; do
        if [[ -f "$OLD_DIR/$f" ]]; then
            cp "$OLD_DIR/$f" "$NEW_DIR/$f"
            echo "    copied: $f"
        else
            echo -e "${YELLOW}    not found in old location (skipped): $f${NC}"
        fi
    done
else
    echo -e "${YELLOW}    $OLD_DIR does not exist — no config to copy${NC}"
fi

# ── Step 2: Deploy new app ─────────────────────────────────────────────────────
# rebuild.sh uses rsync --delete but excludes chimes.json, so the copy above is safe.
echo -e "${GREEN}--> Step 2: Deploy JamRTC to $NEW_DIR${NC}"
bash "$SCRIPT_DIR/rebuild.sh" "$NEW_DIR"

# Sanity check: warn loudly if config.php is still missing after deploy
if [[ ! -f "$NEW_DIR/config.php" ]]; then
    echo -e "${YELLOW}"
    echo    "    ⚠️  WARNING: $NEW_DIR/config.php is missing!"
    echo    "    TURN server credentials are not configured."
    echo    "    Peers behind NAT may fail to connect."
    echo    "    Copy config.php manually, or run:"
    echo    "      cp $OLD_DIR/config.php $NEW_DIR/config.php"
    echo -e "${NC}"
fi

# ── Step 2: Tombstone service worker ──────────────────────────────────────────
# The old SW (midi-streamer-v*) may still be installed in users' browsers.
# We drop a replacement SW that:
#   - Claims all clients immediately
#   - On install: opens and deletes ALL caches (including old midi-streamer-v* ones)
#   - On fetch: redirects every navigation request to /jamrtc/
#   - After 24 h the browser will re-check and find… nothing, so it unregisters.
echo -e "${GREEN}--> Step 3: Install tombstone service worker into old location${NC}"
if [[ -d "$OLD_DIR" ]]; then
    cat > "$OLD_DIR/service-worker.js" << 'SWEOF'
// Tombstone service worker for the old web_midi_streamer location.
// Purpose: nuke all stale caches and redirect visitors to /jamrtc/.
// This file intentionally has no CACHE_NAME — it caches nothing.

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.map((name) => {
                console.log('[Tombstone SW] Deleting cache:', name);
                return caches.delete(name);
            }))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    // Redirect all navigation requests (page loads) to /jamrtc/
    if (event.request.mode === 'navigate') {
        const newUrl = '/jamrtc/' + url.search + url.hash;
        event.respondWith(Response.redirect(newUrl, 301));
        return;
    }
    // For sub-resources: fall through to network (they'll 404 or redirect)
});
SWEOF
    echo "    tombstone SW written to $OLD_DIR/service-worker.js"
else
    echo -e "${YELLOW}    $OLD_DIR does not exist yet — tombstone skipped (nothing to migrate)${NC}"
fi

# ── Step 3: Replace old directory with redirect page ──────────────────────────
echo -e "${GREEN}--> Step 4: Write redirect page to $OLD_DIR${NC}"
mkdir -p "$OLD_DIR"

cat > "$OLD_DIR/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Moved Permanently — JamRTC</title>
    <meta http-equiv="refresh" content="0; url=/jamrtc/">
    <link rel="canonical" href="/jamrtc/">
    <style>
        body {
            font-family: system-ui, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #0f0f1a;
            color: #e2e8f0;
        }
        .box {
            text-align: center;
            padding: 2rem;
        }
        h1 { color: #6366f1; font-size: 2rem; margin-bottom: 0.5rem; }
        p  { color: #94a3b8; margin-bottom: 1.5rem; }
        a  {
            display: inline-block;
            background: #6366f1;
            color: #fff;
            padding: 0.7rem 1.8rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 600;
        }
        a:hover { background: #4f46e5; }
    </style>
</head>
<body>
    <div class="box">
        <h1>🎹 JamRTC</h1>
        <p>This app has moved permanently.<br>Redirecting you now…</p>
        <a href="/jamrtc/">Go to JamRTC</a>
    </div>
    <script>
        // Hard-redirect in case meta-refresh is blocked
        window.location.replace('/jamrtc/');
    </script>
</body>
</html>
HTMLEOF

# Remove all old app files from the old directory — only keep index.html + tombstone SW.
# We do this carefully: delete everything EXCEPT those two files.
echo "    Pruning old app assets from $OLD_DIR (keeping index.html + service-worker.js)..."
find "$OLD_DIR" -mindepth 1 \
    ! -name 'index.html' \
    ! -name 'service-worker.js' \
    -delete 2>/dev/null || true

echo "    Done — $OLD_DIR now contains only the redirect + tombstone SW."

# ── Step 4: Nginx hint ─────────────────────────────────────────────────────────
echo
echo -e "${YELLOW}==> Optional: add a proper 301 in nginx for belt-and-suspenders:${NC}"
echo    "    location ^~ /web_midi_streamer/ {"
echo    "        return 301 /jamrtc/\$request_uri;"
echo    "    }"
echo

echo -e "${GREEN}==> Migration complete.${NC}"
echo    "    Old location : $OLD_DIR  (redirect + tombstone SW)"
echo    "    New location : $NEW_DIR  (full JamRTC app)"
echo
echo -e "${YELLOW}    Signaler was NOT touched — restart manually if needed:${NC}"
echo    "    sudo systemctl restart jamrtc-signaler"
