import { Button } from "@/shared/ui/button";
import { ArrowUp } from "lucide-react";

/**
 * A button that scrolls its container back to the top, which sticks to the bottom of the
 * container, and is only revealed once it's been scrolled (via a scroll-driven animation).
 * And so, it must be the last child of the scrolled content.
 */
export function ScrollToTop({ hasBottomBar = false }: { hasBottomBar?: boolean }) {
  return (
    <div
      className={`sticky ${hasBottomBar ? "bottom-24" : "bottom-8"} h-0 flex justify-center pointer-events-none`}
    >
      <Button
        variant="ghost"
        size="sm"
        className="scroll-reveal pointer-events-auto -translate-y-full rounded-full p-2 h-8 bg-background shadow-lg"
        onClick={(e) => {
          // Scroll the nearest scrolled ancestor (or the page)
          let container = e.currentTarget.parentElement;
          while (container && container.scrollTop === 0) container = container.parentElement;
          (container ?? document.scrollingElement)?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        title="Scroll to top"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}
