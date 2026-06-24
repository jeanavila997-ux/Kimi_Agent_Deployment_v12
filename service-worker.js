/**
 * Service Worker — TDAH Descomplicado Ebook PWA
 * Versão v2.2.0 — Cache-First para recursos estáticos essenciais (Offline-capable)
 */

const CACHE_NAME = 'tdah-ebook-v2.2.0';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  './privacidade.html',
  './manifest.json',
  './css/main.css',
  './css/components.css',
  './css/auth-gateway.css',
  './js/config.js',
  './js/generator.js',
  './js/main-controller.js',
  './js/integrations.js',
  './briefings/briefing.json',
  './js/vendor/chart.min.js',
  './js/vendor/jspdf.umd.min.js',
  './assets/icons/icon-72x72.png',
  './assets/icons/icon-96x96.png',
  './assets/icons/icon-128x128.png',
  './assets/icons/icon-144x144.png',
  './assets/icons/icon-152x152.png',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-384x384.png',
  './assets/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando assets estáticos...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deletando cache antigo:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-First strategy com fallback para rede
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições para Supabase (API / DB) ou domínios externos
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Encontra no cache
        }
        
        // Se não estiver no cache, busca na rede e guarda em cache dinamicamente
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return networkResponse;
        });
      }).catch(() => {
        // Fallback offline se a rede falhar
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
