/*
 * Self-destroying service worker.
 *
 * The site doesn't use a service worker. Older versions did (next-pwa, then
 * briefly vite-plugin-pwa), registered at this URL, and an installed one keeps
 * serving from its caches until something replaces it. Browsers re-check this
 * URL for updates, so serving this here retires them: it deletes every cache,
 * unregisters itself, and reloads any open pages once so they're served
 * straight from the network.
 *
 * The app never registers it, so new visitors never get it. Keep it here
 * indefinitely; it costs nothing.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      await self.registration.unregister();

      const windows = await self.clients.matchAll({ type: "window" });
      await Promise.all(windows.map((client) => client.navigate(client.url)));
    })()
  );
});
