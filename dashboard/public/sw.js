// Minimal app-shell service worker, hand-written rather than generated, so it's easy to read and
// change without a build step of its own. Two strategies only:
//
//  - Static assets (JS/CSS/the page itself): cache-first, so the app still opens with no signal.
//    Every deploy needs a new CACHE_NAME so the old cache gets dropped on activate -- this used to
//    be a manual bump-it-yourself step here, and it got forgotten three deploys running (2026-10-16),
//    leaving the installed phone app stuck on a stale bundle with no visible error. It's no longer
//    manual: scripts/stamp-sw-cache.mjs rewrites the line below in dist/sw.js after every
//    `npm run build` (wired as the "postbuild" script in package.json), stamping in the Netlify
//    commit SHA (or local git SHA / timestamp as a fallback). Don't hand-edit the value below for
//    a real deploy -- it's just the placeholder this file ships with; the build always overwrites it.
//  - Everything live (/api/*, /portfolio/*.json): network-first. Prices and holdings must never
//    look live when they're actually a stale cache; the cached copy is only a fallback for when
//    the network request itself fails (e.g. truly offline), and the app's own "as of" labels
//    already say when the data is from.
const CACHE_NAME = "chip-watch-shell-dev";
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

// The private portfolio endpoint is never stored by the service worker: it is gated by an access
// code, and a cached copy would outlive a "Lock" or a changed code. The page's own fetch also sends
// the code, so a network failure simply shows the page's error instead of stale holdings.
function isPrivate(url) {
  return url.pathname === "/api/portfolio";
}

function isLiveData(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/portfolio/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache a POST/etc.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave fonts.googleapis.com etc. alone

  if (isPrivate(url)) return; // straight to the network, no caching

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
