import { Button } from "@/shared/ui/button";
import { ArrowUp } from "lucide-react";

/** Scrolls an element's nearest scrolled ancestor (or the page) back to the top. */
function scrollToTop(element: HTMLElement) {
  let container = element.parentElement;
  while (container && container.scrollTop === 0) container = container.parentElement;
  (container ?? document.scrollingElement)?.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * A button that scrolls its container back to the top, which sticks to the bottom of the
 * container, and is only revealed once it's been scrolled (via a scroll-driven animation).
 * And so, it must be the last child of the scrolled content.
 */
export function ScrollToTop({ isActionBarVisible = true }: { isActionBarVisible?: boolean }) {
  return (
    <div
      className={`sticky ${isActionBarVisible ? "bottom-24" : "bottom-8"} h-0 flex justify-center pointer-events-none`}
    >
      <Button
        variant="ghost"
        size="sm"
        className="scroll-reveal pointer-events-auto -translate-y-full rounded-full p-2 h-8 border border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-lg dark:shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-xl dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] transition-all"
        onClick={(e) => scrollToTop(e.currentTarget)}
        title="Scroll to top"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}
