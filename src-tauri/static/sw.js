// Quack Remote Dashboard — Service Worker
// Enables PWA notifications on iOS 16.4+ and all browsers.

const CACHE_NAME = 'quack-v1';

// Install: cache shell assets
self.addEventListener('install', () => self.skipWaiting());

// Activate: claim all clients immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Listen for notification requests from the app
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title || 'Quack Agent', {
      body: e.data.body || 'Agent replied',
      icon: '/dashboard/icon-192.png',
      badge: '/dashboard/icon-192.png',
      tag: 'quack-reply',
      renotify: true,
    });
  }
});

// Handle notification click: focus or open the dashboard
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('/dashboard'));
      if (existing) return existing.focus();
      return self.clients.openWindow('/dashboard');
    })
  );
});
