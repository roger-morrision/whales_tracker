/**
 * Service Worker for Whales Tracker (Moby)
 * Handles caching, offline support, background sync, and push notifications
 */

const CACHE_NAME = 'moby-v1';
const STATIC_CACHE = 'moby-static-v1';
const DYNAMIC_CACHE = 'moby-dynamic-v1';
const API_CACHE = 'moby-api-v1';

// Cache strategies
const STRATEGIES = {
  static: 'cache-first',
  api: 'stale-while-revalidate',
  price: 'network-first',
  html: 'network-first',
};

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/favicon.ico',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Static assets cached');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== API_CACHE &&
              name.startsWith('moby-')
            );
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine cache strategy based on URL
  let strategy = STRATEGIES.static;
  let cacheName = STATIC_CACHE;
  
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/prices') || url.pathname.includes('/quote')) {
      strategy = STRATEGIES.price;
      cacheName = API_CACHE;
    } else {
      strategy = STRATEGIES.api;
      cacheName = API_CACHE;
    }
  } else if (url.pathname.endsWith('.html') || url.pathname === '/') {
    strategy = STRATEGIES.html;
    cacheName = DYNAMIC_CACHE;
  } else if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    strategy = STRATEGIES.static;
    cacheName = STATIC_CACHE;
  }

  event.respondWith(handleRequest(request, strategy, cacheName));
});

// Handle request with specified strategy
async function handleRequest(request, strategy, cacheName) {
  const cache = await caches.open(cacheName);
  
  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request, cache);
    case 'network-first':
      return networkFirst(request, cache);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request, cache);
    case 'network-only':
      return networkOnly(request);
    case 'cache-only':
      return cacheOnly(request, cache);
    default:
      return networkFirst(request, cache);
  }
}

// Cache first - serve from cache, fallback to network
async function cacheFirst(request, cache) {
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network first - try network, fallback to cache
async function networkFirst(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Stale while revalidate - serve from cache, update in background
async function staleWhileRevalidate(request, cache) {
  const cachedResponse = await cache.match(request);
  
  const networkResponsePromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  if (cachedResponse) {
    // Serve cached immediately, update in background
    networkResponsePromise.catch(() => {}); // Ignore errors
    return cachedResponse;
  }
  
  // No cache, wait for network
  const networkResponse = await networkResponsePromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

// Network only - always fetch from network
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Cache only - only serve from cache
async function cacheOnly(request, cache) {
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  return new Response('Not cached', { status: 404, statusText: 'Not Found' });
}

// Background sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag.startsWith('sync-')) {
    event.waitUntil(handleBackgroundSync(event.tag));
  }
});

async function handleBackgroundSync(tag) {
  const [, type, taskId] = tag.split('-');
  
  try {
    // Get pending tasks from IndexedDB (via client)
    const clients = await self.clients.matchAll();
    
    for (const client of clients) {
      client.postMessage({
        type: 'PROCESS_SYNC',
        payload: { type, taskId },
      });
    }
    
    // Notify completion
    const clients2 = await self.clients.matchAll();
    for (const client of clients2) {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        payload: { taskId, success: true },
      });
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        payload: { taskId, success: false, error: error.message },
      });
    }
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }
  
  const options = {
    body: data.body || 'New update from Moby',
    icon: data.icon || '/logo.svg',
    badge: data.badge || '/logo.svg',
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    tag: data.tag || 'moby-notification',
    renotify: data.renotify || false,
    timestamp: data.timestamp || Date.now(),
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Moby', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      clearCache(payload?.cacheName).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
    case 'GET_CACHE_SIZE':
      getCacheSize().then((size) => {
        event.ports[0]?.postMessage({ success: true, size });
      });
      break;
    case 'PROCESS_SYNC':
      handleBackgroundSync(`sync-${payload.type}-${payload.taskId}`);
      break;
  }
});

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
}

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let total = 0;
  const byCache = {};
  
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    let size = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        size += blob.size;
      }
    }
    byCache[name] = size;
    total += size;
  }
  
  return { total, byCache };
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'price-update') {
    event.waitUntil(updatePrices());
  } else if (event.tag === 'portfolio-sync') {
    event.waitUntil(syncPortfolio());
  }
});

async function updatePrices() {
  // Would fetch latest prices and update cache
  console.log('[SW] Updating prices...');
}

async function syncPortfolio() {
  // Would sync portfolio data
  console.log('[SW] Syncing portfolio...');
}

console.log('[SW] Service worker loaded');