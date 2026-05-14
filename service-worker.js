// Service Worker for Web MIDI Streamer PWA
// Strategy:
//   - service-worker.js itself: NETWORK ONLY (browser handles this via updateViaCache)
//   - HTML (index.html, /): NETWORK FIRST → cache fallback (so updates are seen)
//   - JS / CSS / fonts / icons: CACHE FIRST → network (fast, versioned by cache name)
//   - /rooms, /signal, API: BYPASS (always network)

const CACHE_NAME = 'midi-streamer-v1.6.1';  // feat: .mid export, emergency hotkey, chat SR, device localisation

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
  basePath + 'src/midi.js',
  basePath + 'src/ui.js',
  basePath + 'src/utils.js',
  basePath + 'src/config.js',
  basePath + 'src/i18n.js',
  basePath + 'src/chord-utils.js',
  basePath + 'src/rooms.js',
  basePath + 'src/recorder.js',
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
      console.log('[SW] Caching static assets');
      // Cache static assets. HTML is intentionally NOT pre-cached so first
      // load always hits the network.
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => console.error('[SW] Install cache failed:', err))
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => {
        if (name !== CACHE_NAME) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        }
      }))
    )
  );
  self.clients.claim();
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
