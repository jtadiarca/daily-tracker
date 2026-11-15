// Minimal service worker for notification clicks (M3).
// Milestone 5 replaces this with src/sw.ts built by vite-plugin-pwa (adds offline caching).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { await c.focus(); c.postMessage({ type: 'OPEN_TODAY' }); return }
    }
    await self.clients.openWindow('/?view=today')
  })())
})
