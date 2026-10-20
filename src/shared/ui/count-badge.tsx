import { cn } from "cn";

/** A count that's overlaid on the corner of a (relatively positioned) button, which is hidden when zero. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;

  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 bg-primary text-primary-foreground text-2xs tabular-nums rounded-full w-4 h-4 flex items-center justify-center",
        className,
      )}
    >
      {count}
    </span>
  );
}
