import { selectLocale } from "../locale";

// Only the app shell belongs in Cache Storage. User images and jobs always go to the server.
const cacheName = "upscayl-app-__REVISION__";
const shell = __SHELL__;
const variantKey = (path, lang) => path + "?offline-lang=" + lang;
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.addAll(
        shell.map((path) => new Request(path, { cache: "reload" })),
      );
      for (const lang of ["en", "ko"]) {
        for (const path of ["/app", "/app.webmanifest"]) {
          const response = await fetch(path, {
            headers: { "Accept-Language": lang },
            cache: "reload",
          });
          if (!response.ok || response.headers.get("Content-Language") !== lang)
            throw Error("Could not cache " + path + " in " + lang);
          await cache.put(variantKey(path, lang), response);
        }
      }
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
  const navigation =
    req.mode === "navigate" && ["/", "/app"].includes(url.pathname);
  if (navigation || url.pathname === "/app.webmanifest") {
    const lang = selectLocale(
      req.headers.get("Accept-Language") || self.navigator.languages.join(","),
    );
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(cacheName);
        return (
          (await cache.match(
            variantKey(navigation ? "/app" : url.pathname, lang),
            { ignoreVary: true },
          )) || Response.error()
        );
      }),
    );
  } else if (shell.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(cacheName)
        .then(async (cache) => (await cache.match(req)) || fetch(req)),
    );
  }
});
