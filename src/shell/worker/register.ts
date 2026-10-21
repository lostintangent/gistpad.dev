import workerUrl from "./service-worker?worker&url";

/** Cache assets downloaded before the first service worker could control this page. */
export async function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  let observer: PerformanceObserver | undefined;
  try {
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;

    // A controller may claim an initially uncontrolled page before this effect runs.
    if (navigation && navigation.workerStart > 0) {
      await navigator.serviceWorker.register(workerUrl);
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    const pending = new Set([`${location.origin}/`]);

    const report = (entries: PerformanceEntry[]) => {
      for (const { name } of entries) {
        if (name.startsWith(`${location.origin}/`)) pending.add(name);
      }
      const worker = registration?.active;
      if (!worker || !pending.size) return;
      worker.postMessage({ type: "CACHE_URLS", payload: { urlsToCache: [...pending] } });
      pending.clear();
    };
    observer = new PerformanceObserver((list) => report(list.getEntries()));
    observer.observe({ type: "resource", buffered: true });

    await navigator.serviceWorker.register(workerUrl);
    registration = await navigator.serviceWorker.ready;
    report(observer.takeRecords());
  } catch (error) {
    observer?.disconnect();
    console.error("Couldn't register GistPad's offline cache", error);
  }
}
