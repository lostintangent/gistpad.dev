import { useSyncExternalStore } from "react";

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export const useIsMobile = () => useMediaQuery(MOBILE_MEDIA_QUERY);
export const useIsDarkMode = () => useMediaQuery("(prefers-color-scheme: dark)");
