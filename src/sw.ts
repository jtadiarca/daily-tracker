/// <reference lib="webworker" />
// Service worker built by vite-plugin-pwa (injectManifest). Excluded from the app tsconfig because it needs the webworker lib.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> }

self.addEventListener('install', () => { void self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Offline: serve the app shell for navigations. Only in production builds, where index.html is precached.
if (import.meta.env.PROD) registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Clicking a reminder notification focuses the app and opens Today.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = all[0]
    if (client) {
      await client.focus()
      client.postMessage({ type: 'OPEN_TODAY' })
      return
    }
    await self.clients.openWindow('/?view=today')
  })())
})
