// Service Worker for Web MIDI Streamer PWA
const CACHE_NAME = 'midi-streamer-v1.2.0';

// Get the base path from the service worker's own URL
const getBasePath = () => {
  const swPath = self.location.pathname;
  return swPath.substring(0, swPath.lastIndexOf('/') + 1);
};

const basePath = getBasePath();

// URLs to cache (relative to the service worker location)
const urlsToCache = [
  basePath,
  basePath + 'index.html',
  basePath + 'style.css',
  basePath + 'src/main.js',
  basePath + 'src/webrtc.js',
  basePath + 'src/midi.js',
  basePath + 'src/ui.js',
  basePath + 'src/utils.js',
  basePath + 'src/config.js',
  basePath + 'src/i18n.js',
  basePath + 'src/chord-utils.js',
  basePath + 'manifest.json',
  basePath + 'favicon.ico',
  basePath + 'tools/index.html',
  basePath + 'tools/nord-effects.html',
  basePath + 'tools/chord-display.html',
  basePath + 'tools/irealb-maker.html',
  basePath + 'tools/help.html'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache, base path:', basePath);
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip signaling and API requests
  if (event.request.url.includes('signaling.php') || 
      event.request.url.includes('get-turn-credentials.php')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all pages immediately
  return self.clients.claim();
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
