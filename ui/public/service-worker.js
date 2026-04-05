/* Trading Dashboard Service Worker */
const CACHE_NAME = 'trading-dashboard-v1';
const ASSETS_CACHE = 'trading-assets-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.ts',
  '/manifest.json',
];

const DYNAMIC_ROUTES = [
  '/api/portfolio',
  '/api/positions',
  '/api/trades',
  '/api/market-data',
];

/* Install Event - Cache static assets */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.log('[ServiceWorker] Cache addAll error:', err);
        });
      }),
    ]).then(() => {
      console.log('[ServiceWorker] Installation complete');
      self.skipWaiting();
    }),
  );
});

/* Activate Event - Clean up old caches */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

/* Fetch Event - Network first, fallback to cache */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { method, url } = request;

  // Skip non-GET requests
  if (method !== 'GET') {
    return;
  }

  // Handle API requests - Network first with cache fallback
  if (url.includes('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle static assets - Cache first with network fallback
  if (
    url.includes('/src/') ||
    url.includes('/assets/') ||
    url.includes('.js') ||
    url.includes('.css')
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default - Network first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Network-first strategy: Try network, fallback to cache
 * Best for dynamic content and API calls
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network request failed, using cache:', error);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page if available
    return caches.match('/offline.html') || new Response('Offline', { status: 503 });
  }
}

/**
 * Cache-first strategy: Try cache, fallback to network
 * Best for static assets
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(ASSETS_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network request failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/* Message Event - Handle messages from clients */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

/* Background Sync - Retry failed requests */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-api-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

async function syncPendingRequests() {
  try {
    const db = await openIndexedDB();
    const requests = await getPendingRequests(db);

    for (const req of requests) {
      try {
        const response = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });

        if (response.ok) {
          await removePendingRequest(db, req.id);
        }
      } catch (error) {
        console.log('[ServiceWorker] Sync request failed:', error);
      }
    }
  } catch (error) {
    console.log('[ServiceWorker] Background sync error:', error);
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('trading-dashboard', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-requests')) {
        db.createObjectStore('pending-requests', { keyPath: 'id' });
      }
    };
  });
}

async function getPendingRequests(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-requests', 'readonly');
    const store = transaction.objectStore('pending-requests');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removePendingRequest(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-requests', 'readwrite');
    const store = transaction.objectStore('pending-requests');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
