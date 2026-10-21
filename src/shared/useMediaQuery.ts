import { useSyncExternalStore } from "react";

// Each media query is one store (with one `MediaQueryList`, and one "change" listener while it has
// subscribers), which every component that asks about it shares. So asking is a snapshot read,
// however many components ask, and however often they render.

interface MediaQueryStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
}

const stores = new Map<string, MediaQueryStore>();

function getStore(query: string): MediaQueryStore {
  const existing = stores.get(query);
  if (existing) return existing;

  let media: MediaQueryList | undefined;
  const getMedia = () => (media ??= window.matchMedia(query));
  const subscribers = new Set<() => void>();
  const notify = () => {
    for (const subscriber of subscribers) subscriber();
  };

  const store: MediaQueryStore = {
    getSnapshot: () => getMedia().matches,
    subscribe: (onChange) => {
      subscribers.add(onChange);
      if (subscribers.size === 1) getMedia().addEventListener("change", notify);

      return () => {
        subscribers.delete(onChange);
        if (subscribers.size === 0) media?.removeEventListener("change", notify);
      };
    },
  };
  stores.set(query, store);
  return store;
}

/** Whether a media query matches (and `serverFallback` where there's no window, e.g. when prerendering). */
function useMediaQuery(query: string, serverFallback = false) {
  const store = getStore(query);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverFallback);
}

export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export const useIsMobile = () => useMediaQuery(MOBILE_MEDIA_QUERY);
export const useIsDarkMode = () => useMediaQuery("(prefers-color-scheme: dark)");
