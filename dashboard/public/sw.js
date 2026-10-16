// Minimal app-shell service worker, hand-written rather than generated, so it's easy to read and
// change without a build step of its own. Two strategies only:
//
//  - Static assets (JS/CSS/the page itself): cache-first, so the app still opens with no signal.
//    A new deploy gets a new CACHE_NAME (bump it below), which drops the old cache on activate.
//  - Everything live (/api/*, /portfolio/*.json): network-first. Prices and holdings must never
//    look live when they're actually a stale cache; the cached copy is only a fallback for when
//    the network request itself fails (e.g. truly offline), and the app's own "as of" labels
//    already say when the data is from.
const CACHE_NAME = "chip-watch-shell-v2";
const SHELL_PATHS = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_PATHS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))),
  );
  self.clients.claim();
});

function isLiveData(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/portfolio/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache a POST/etc.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave fonts.googleapis.com etc. alone

  if (isLiveData(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        }),
    ),
  );
});
