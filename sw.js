// Service worker: network-first for same-origin GETs (always fresh online),
// falling back to the cache when offline. Avoids staleness while giving offline support.
// Bump CACHE to invalidate everything previously stored (old versioned assets, etc.).
const CACHE = "ursonice-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== location.origin) return; // skip GA, giscus, fonts, CDNs

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache real responses — a cached 404/500 would keep serving errors offline.
        if (res.ok) {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(request, copy))
            .catch(() => {}); // quota/opaque failures must not surface as unhandled rejections
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            // Offline navigation to an uncached page → fall back to the cached homepage.
            // (The homepage is cached under its real key "/", not "/index.html".)
            (request.mode === "navigate" ? caches.match("/") : undefined),
        ),
      ),
  );
});
