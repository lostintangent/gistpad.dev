import { cn } from "@/lib/utils";
import * as React from "react";

interface ScrollableTextProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ScrollableText({
  children,
  className,
  ...props
}: ScrollableTextProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [showRightBlur, setShowRightBlur] = React.useState(false);
  const [showLeftBlur, setShowLeftBlur] = React.useState(false);

  const checkOverflow = React.useCallback(() => {
    if (containerRef.current && contentRef.current) {
      const container = containerRef.current;
      const content = contentRef.current;

      // Check if content width exceeds container width
      const hasOverflow = content.scrollWidth > container.clientWidth;

      // Check if scrolled to the end
      const isScrolledToEnd =
        container.scrollLeft + container.clientWidth >= content.scrollWidth - 1;

      // Check if scrolled away from the start
      const isScrolledFromStart = container.scrollLeft > 0;

      // Only show the right blur if there's overflow and not scrolled to the end
      setShowRightBlur(hasOverflow && !isScrolledToEnd);

      // Only show the left blur if scrolled away from the start
      setShowLeftBlur(isScrolledFromStart);
    }
  }, []);

  // Check for overflow on mount and whenever the content changes
  React.useEffect(() => {
    checkOverflow();
    // Use ResizeObserver to detect changes in content size
    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
    });

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [checkOverflow, children]);

  // Handle scroll events
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkOverflow();
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [checkOverflow]);

  return (
    <div className={cn("relative w-full", className)} {...props}>
      <div
        ref={containerRef}
        className="overflow-x-auto whitespace-nowrap scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div ref={contentRef} className="inline-block">
          {children}
        </div>
      </div>
      {showLeftBlur && (
        <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-linear-to-r from-background group-hover:from-muted selected:from-primary! to-transparent" />
      )}
      {showRightBlur && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-linear-to-l from-background group-hover:from-muted selected:from-primary! to-transparent" />
      )}
    </div>
  );
}
