// ─── sw-push.js — Push notification handler (merged into PWA service worker) ──
// This file is injected into the Workbox-generated service worker via
// vite-plugin-pwa's importScripts option.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'VALERIE', body: event.data.text() }; }

  const { title = 'VALERIE', body = '', icon, tag, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     icon  || '/assets/icon-192.png',
      badge:          '/assets/icon-192.png',
      tag:      tag   || 'valerie-notification',
      renotify: true,
      data:     { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
