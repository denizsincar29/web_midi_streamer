// Service Worker for JamRTC PWA
// Strategy:
//   - service-worker.js itself: NETWORK ONLY (browser handles this via updateViaCache)
//   - HTML (index.html, /): NETWORK FIRST → cache fallback (so updates are seen)
//   - JS / CSS / fonts / icons: CACHE FIRST → network (fast, versioned by cache name)
//   - /rooms, /signal, API: BYPASS (always network)

const CACHE_NAME = 'jamrtc-v2.0.22';  // feat: stale-cache peer warning + easter egg nick fix

const getBasePath = () => {
  const swPath = self.location.pathname;
  return swPath.substring(0, swPath.lastIndexOf('/') + 1);
};
const basePath = getBasePath();

// Static assets that are safe to serve from cache
const STATIC_ASSETS = [
  basePath + 'style.css',
  basePath + 'src/main.js',
  basePath + 'src/app.js',
  basePath + 'src/webrtc.js',
  basePath + 'src/midi-worker.js',
  basePath + 'src/piano.js',
  basePath + 'src/synth.js',
  basePath + 'src/midi.js',
  basePath + 'src/ui.js',
  basePath + 'src/utils.js',
  basePath + 'src/config.js',
  basePath + 'src/i18n.js',
  basePath + 'src/chord-utils.js',
  basePath + 'src/rooms.js',
  basePath + 'src/recorder.js',
  basePath + 'src/participants.js',
  basePath + 'manifest.json',
  basePath + 'favicon.ico',
];

// HTML pages — network first so updates are always picked up
const HTML_ASSETS = [
  basePath,
  basePath + 'index.html',
  basePath + 'help-en.html',
  basePath + 'help-ru.html',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets for', CACHE_NAME);
      // Cache assets one-by-one so a single 404 doesn't abort the whole install.
      // Each failure is logged but does not prevent the SW from activating.
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err))
        )
      );
    })
    .then(() => {
      console.log('[SW] Install complete:', CACHE_NAME);
      // Take control immediately — don't wait for all tabs to close.
      return self.skipWaiting();
    })
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        }))
      )
      .then(() => {
        console.log('[SW] Activated:', CACHE_NAME);
        // Claim all open tabs immediately so they get the new SW without reload.
        return self.clients.claim();
      })
      .then(() => {
        // Tell all clients to reload so they pick up fresh JS/CSS.
        // Without this, open tabs continue running old JS even though the SW
        // is now serving new files — the page needs to reload to re-execute them.
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          for (const client of clients) {
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
          }
        });
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always bypass: signaling, API, dynamic endpoints
  if (
    url.pathname.includes('/signal') ||
    url.pathname.endsWith('/rooms') ||
    url.pathname.endsWith('/health') ||
    url.pathname.endsWith('/hide-room') ||
    url.pathname.endsWith('/show-room') ||
    url.pathname.includes('get-turn-credentials')
  ) {
    return; // let browser handle it natively
  }

  const isHtml = HTML_ASSETS.some(p => url.pathname === p || url.pathname === p.replace(/\/$/, ''))
               || url.pathname.endsWith('.html')
               || url.pathname === basePath;

  if (isHtml) {
    // NETWORK FIRST for HTML — user always gets latest version
    // Falls back to cache if offline
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CACHE FIRST for static JS/CSS/assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// ── Messages ──────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
