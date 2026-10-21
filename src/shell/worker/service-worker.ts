/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { enable as enableNavigationPreload } from "workbox-navigation-preload";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

const expiration = new ExpirationPlugin({ maxEntries: 256, purgeOnQuotaError: true });

registerRoute(
  ({ request, url, sameOrigin }) =>
    sameOrigin && (request.mode === "navigate" || /^\/(?:index\.html)?$/.test(url.pathname)),
  new NetworkFirst({
    cacheName: "gistpad",
    matchOptions: { ignoreSearch: true },
    plugins: [expiration],
  }),
);

registerRoute(
  ({ request, url, sameOrigin }) =>
    sameOrigin && url.pathname.startsWith("/assets/") && !request.headers.has("range"),
  new CacheFirst({ cacheName: "gistpad", plugins: [expiration] }),
);

registerRoute(
  ({ request, sameOrigin }) => sameOrigin && !request.headers.has("range"),
  new StaleWhileRevalidate({ cacheName: "gistpad", plugins: [expiration] }),
);

clientsClaim();
enableNavigationPreload();
void self.skipWaiting();
