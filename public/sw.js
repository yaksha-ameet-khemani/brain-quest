// Brain Quest service worker - what makes the installed app (app/manifest.ts)
// behave like an app when the connection drops. Deliberately small:
// * pages and /api/* are NEVER served from a cache - every answer is graded by
//   the server and points/rounds must always be current, so a stale copy
//   would be worse than no copy;
// * a page that can't load because there's no internet shows /offline.html
//   instead of the browser's error screen;
// * Next's build files (/_next/static/*, content-hashed so they never change)
//   are cached after first use so the app opens faster.
// Bump CACHE when this file or offline.html changes; old caches are removed.
const CACHE = "brain-quest-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
