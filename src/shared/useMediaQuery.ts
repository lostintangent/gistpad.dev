import { useSyncExternalStore } from "react";

// Each media query is one store (with one `MediaQueryList`, and one "change" listener while it has
// subscribers), which every component that asks about it shares. So asking is a snapshot read,
// however many components ask, and however often they render.

function createMediaQueryStore(query: string) {
  let media: MediaQueryList | undefined;
  const getMedia = () => (media ??= window.matchMedia(query));
  const subscribers = new Set<() => void>();
  const notify = () => {
    for (const subscriber of subscribers) subscriber();
  };

  return {
    getSnapshot: () => getMedia().matches,
    subscribe: (onChange: () => void) => {
      subscribers.add(onChange);
      if (subscribers.size === 1) getMedia().addEventListener("change", notify);

      return () => {
        subscribers.delete(onChange);
        if (subscribers.size === 0) media?.removeEventListener("change", notify);
      };
    },
  };
}

export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const mobile = createMediaQueryStore(MOBILE_MEDIA_QUERY);
const darkMode = createMediaQueryStore("(prefers-color-scheme: dark)");

/** Whether a media query matches (which it never does where there's no window, e.g. when prerendering). */
const useMediaQuery = ({ subscribe, getSnapshot }: ReturnType<typeof createMediaQueryStore>) =>
  useSyncExternalStore(subscribe, getSnapshot, () => false);

export const useIsMobile = () => useMediaQuery(mobile);
export const useIsDarkMode = () => useMediaQuery(darkMode);
