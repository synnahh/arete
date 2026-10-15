// ─── sw-push.js — Push notification handler (merged into PWA service worker) ──
// This file is injected into the Workbox-generated service worker via
// vite-plugin-pwa's importScripts option.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'Arete', body: event.data.text() }; }

  const { title = 'Arete', body = '', icon, tag, url } = payload;

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
      const tab = (() => { try { return new URL(url, self.location.origin).searchParams.get('go'); } catch { return null; } })();
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (tab) client.postMessage({ type: 'arete-go', tab });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
