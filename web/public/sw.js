const CACHE = 'visiora-v0.3.0-__BUILD_ID__';
const ASSETS = __PRECACHE__;
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('visiora-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PREPARE_OFFLINE')
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE);
          // Explicit allow-list: no image, audio, camera, transcript, or runtime request is persisted.
          for (const asset of ASSETS) {
            const response = await fetch(asset, { cache: 'reload' });
            if (!response.ok) throw new Error('Download incompleto.');
            await cache.put(asset, response);
          }
          event.source?.postMessage({ type: 'OFFLINE_READY' });
        } catch (error) {
          event.source?.postMessage({ type: 'OFFLINE_ERROR', message: String(error) });
        }
      })(),
    );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const asset = event.request.mode === 'navigate' ? '/index.html' : url.pathname;
  if (!ASSETS.includes(asset)) return;
  event.respondWith((async () => (await caches.match(asset)) || fetch(event.request))());
});
