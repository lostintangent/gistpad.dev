import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Text that scrolls horizontally (rather than wrapping), and fades out at the edges that
 * can be scrolled to (using a scroll-driven mask, so it works on any background).
 */
export function ScrollableText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block w-full max-w-full min-w-0 overflow-x-scroll overflow-y-hidden whitespace-nowrap no-scrollbar",
        "scroll-fade-x scroll-fade-8 [--scroll-fade-reveal:2rem] [animation-timing-function:linear]",
        className,
      )}
    >
      {children}
    </span>
  );
}
