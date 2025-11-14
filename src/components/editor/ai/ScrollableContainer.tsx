import { cn } from "@/lib/utils";
import * as React from "react";

interface ScrollableContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  containerClassName?: string;
  ref?: React.MutableRefObject<HTMLDivElement>;
}

const ScrollableContainer = (({ children, className, containerClassName, ref, ...props }: ScrollableContainerProps) => {
  const [showTopBlur, setShowTopBlur] = React.useState(false);
  const [showBottomBlur, setShowBottomBlur] = React.useState(false);

  const contentRef = React.useRef<HTMLDivElement>(null);

  const checkOverflow = React.useCallback(() => {
    if (ref.current && contentRef.current) {
      const container = ref.current;
      const content = contentRef.current;

      const hasOverflow = content.scrollHeight > container.clientHeight;
      const isScrolledToBottom =
        container.scrollTop + container.clientHeight >=
        content.scrollHeight - 1;
      const isScrolledFromTop = container.scrollTop > 0;

      setShowBottomBlur(hasOverflow && !isScrolledToBottom);
      setShowTopBlur(isScrolledFromTop);
    }
  }, []);

  React.useEffect(() => {
    checkOverflow();
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

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const handleScroll = () =>
      checkOverflow();

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [checkOverflow]);

  return (
    <div className={cn("relative w-full", className)} {...props}>
      <div
        ref={ref}
        className={cn("overflow-y-auto scrollbar-hide", containerClassName)}
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {showTopBlur && (
        <div className="pointer-events-none absolute left-2 right-2 top-0 h-20 bg-linear-to-b from-background group-hover:from-muted selected:from-primary! to-transparent" />
      )}
      {showBottomBlur && (
        <div className="pointer-events-none absolute left-2 right-2 bottom-0 h-20 bg-linear-to-t from-background group-hover:from-muted selected:from-primary! to-transparent" />
      )}
    </div>
  );
});

export default ScrollableContainer;
