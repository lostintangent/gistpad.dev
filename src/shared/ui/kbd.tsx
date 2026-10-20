import { cn } from "cn";
import type { ReactNode } from "react";

/** A key (or key combination), e.g. in a shortcut hint. */
export function Kbd({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-2xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
