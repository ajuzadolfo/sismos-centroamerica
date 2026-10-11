// Service Worker para Sismos Centroamérica (Fozna Solutions)
const CACHE_NAME = 'sismos-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/monitor',
  '/favicon.svg',
  '/favicon.ico',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo aplicar caché a peticiones GET de la misma fuente o estáticos
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Evitar interceptar WebSockets o llamadas a API dinámica
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          // Fallback a página de inicio si falla navegación
          if (event.request.mode === 'navigate') {
            return caches.match('/monitor');
          }
        })
      );
    })
  );
});

// Soporte para notificaciones push en segundo plano
self.addEventListener('push', (event) => {
  let data = { title: 'Alerta Sísmica Centroamérica', body: 'Nuevo evento sísmico detectado.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200, 100, 400],
    data: {
      url: data.url || '/monitor'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/monitor')
  );
});
