/**
 * Service Worker — TDAH Descomplicado Ebook PWA
 * Versão v2.1.1 — Cleanup: remove todos os caches antigos
 */

const CACHE_VERSION = 'v2.1.1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-only: nunca cacheia, sempre busca do servidor
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
