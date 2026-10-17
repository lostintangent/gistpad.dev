/// <reference lib="webworker" />

// A service worker that caches the app's files, so that it loads instantly (and works offline) on
// return visits. Since the app's files are content-hashed (i.e. they never change), they're served
// from the cache. But the page itself is fetched from the network (unless the user is offline), so
// that it's always up to date, and always refers to files from the same version of the app.

/** Every file in this version of the app (which are added by the build script). */
declare const BUILD_FILES: string[];
/** The files that the app needs to open, which are cached when the service worker is installed. */
declare const STARTUP_FILES: string[];

declare const self: ServiceWorkerGlobalScope;

const CACHE = "gistpad";

/** Caches a (successful) response, once it's downloaded. */
function cacheResponse(event: FetchEvent, key: Request | string, response: Response) {
  if (response.status === 200) {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE).then((cache) => cache.put(key, copy)));
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(STARTUP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Start fetching pages while the service worker starts (rather than after)
      await self.registration.navigationPreload?.enable();

      // Remove files from previous versions of the app (which are no longer deployed)
      const cache = await caches.open(CACHE);
      const files = new Set(BUILD_FILES.map((file) => new URL(file, self.registration.scope).href));
      for (const request of await cache.keys()) {
        if (!files.has(request.url)) await cache.delete(request);
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // (Requests to other origins, like GitHub's API, and media range requests, use the network)
  const isAppFile = new URL(request.url).origin === location.origin;
  if (request.method !== "GET" || !isAppFile || request.headers.has("range")) return;

  if (request.mode === "navigate") {
    // Hash-based routes mean that the app only has one page, which is cached as the scope's URL
    const page = self.registration.scope;
    event.respondWith(
      (async () => {
        try {
          const response = (await event.preloadResponse) ?? (await fetch(request));
          return cacheResponse(event, page, response);
        } catch {
          return (await caches.match(page)) ?? Response.error();
        }
      })(),
    );
  } else {
    event.respondWith(
      caches
        .match(request)
        .then(
          (cached) =>
            cached ?? fetch(request).then((response) => cacheResponse(event, request, response)),
        ),
    );
  }
});

export {};
