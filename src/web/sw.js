// Only the app shell belongs in Cache Storage. User images and jobs always go to the server.
const cacheName = "upscayl-app-__REVISION__";
const shell = __SHELL__;
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.addAll(
        shell.map((path) => new Request(path, { cache: "reload" })),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("upscayl-app-") && key !== cacheName)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.search)
    return;
  if (req.mode === "navigate" && ["/", "/app"].includes(url.pathname)) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.open(cacheName).then((cache) => cache.match("/app")),
      ),
    );
  } else if (url.pathname !== "/app" && shell.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(cacheName)
        .then(async (cache) => (await cache.match(req)) || fetch(req)),
    );
  }
});
