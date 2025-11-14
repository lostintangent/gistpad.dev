import { ArrowUp } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "../ui/button";

interface ScrollToTopProps {
  containerRef?: React.RefObject<HTMLElement>;
  threshold?: number;
  isActionBarVisible?: boolean;
}

export function ScrollToTop({
  containerRef = null,
  threshold = 100,
  isActionBarVisible = true,
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [left, setLeft] = useState<number | undefined>();

  useEffect(() => {
    function handleScroll() {
      // Note: The window doesn't have a scrollTop property, so
      // we need to specifically check the <html> element's position.
      const container = containerRef?.current || document.documentElement;
      setIsVisible(container.scrollTop > threshold);
    }

    // Note: The <html> element doesn't allow a scroll handler
    // so we have to fall back to the window.
    const container = containerRef?.current || window;
    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, threshold]);

  useLayoutEffect(() => {
    function updateLeft() {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setLeft(rect.left + rect.width / 2);
      } else {
        setLeft(window.innerWidth / 2);
      }
    }

    updateLeft();

    window.addEventListener("resize", updateLeft);

    const observer =
      containerRef?.current && new ResizeObserver(updateLeft);
    if (observer && containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateLeft);
      observer?.disconnect();
    };
  }, [containerRef?.current]);

  if (!isVisible) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`fixed ${isActionBarVisible ? "bottom-24" : "bottom-8"} -translate-x-1/2 rounded-full p-2 h-8 border border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-lg dark:shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-xl dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] transition-all`}
      style={{ left }}
      onClick={() => {
        const container = containerRef?.current || window;
        container.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }}
      title="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}
