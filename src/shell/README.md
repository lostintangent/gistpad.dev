# Static application shell

`router/routes.ts` maps URLs to `features/*/routes/` modules using TanStack virtual file routes.
The router entry and generated tree live alongside that map. This folder owns the root document,
global styles, loading shell, and browser startup support grouped under `prepaint/` and `worker/`.
Features own their route loaders, lazy pages, components, and layout.

Start SPA mode prerenders the root document with `LoadingShell`, which renders the actual sign-in,
workbench, and share components. React Suspense selects the browser page without hydrating a
mismatched build-time layout. Features retain their own skeletons and lazy boundaries.

`prepaint/script.ts` runs through Router’s `ScriptOnce` before paint. It resolves the hash and selects
the page. Layout belongs to `features/workbench/layout/prepaint.ts`, which uses shared preferences.
Its small Bun bundle makes those imported helpers available inline; Start handles prerendering.
The token is only a UI hint; Router’s hydration hook restores Query and completes OAuth before routing.

Vite bundles `worker/service-worker.ts` at `/sw.js`. Workbox fetches the document network-first and caches
assets as used. Resource replay caches the document and downloads made before first control.
Updates retain cached chunks and do not reload the page; never-cached chunks can disappear on deploy.
