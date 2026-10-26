/**
 * SERVICE WORKER
 *
 * A small script the browser runs in the background, between the app and the
 * network. Ours does three things:
 *   1. Pages (navigations): try the network first, so you always see your
 *      latest schedule. If you're offline, show the /offline page.
 *   2. Build files (/_next/static/*): their names change with every deploy,
 *      so a cached copy is always correct. Serve from cache, fetch once.
 *   3. Everything else (API calls, sign-in, Supabase, server actions): not
 *      touched at all. Private data is never stored in the cache.
 *
 * Bump VERSION to throw away old caches after a change to this file.
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
