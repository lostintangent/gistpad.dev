import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/* 
This hook listens for viewport changes to determine
whether the current device is mobile or not.
*/

const getMatchMedia = () =>
  typeof window !== "undefined"
    ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    : null;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mediaQuery = getMatchMedia();
    if (!mediaQuery) return;

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // Sync immediately in case the initial state was wrong
    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Support older browsers that still expose addListener/removeListener
      const legacyHandler = (event: MediaQueryListEvent) =>
        handleChange(event);
      mediaQuery.addListener(legacyHandler);
      return () => mediaQuery.removeListener(legacyHandler);
    }
  }, []);

  return isMobile;
}
