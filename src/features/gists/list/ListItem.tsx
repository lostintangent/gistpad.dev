import { openFile } from "@/features/files/file";
import { closeMobilePanels } from "@/features/editor/layout";
import { cn } from "cn";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Scrolls the open item into view, whenever it's (newly) opened. */
const scrollIntoView = (element: HTMLElement | null) =>
  element?.scrollIntoView({ behavior: "smooth", block: "center" });

/**
 * An item in the gist list, which links to a gist (or one of its files), and has an action on its
 * right edge, so the whole item is highlighted together (e.g. while it's open). Since it's a real
 * link, the gist is preloaded when hovered, and can be opened in a new tab. And Cmd/Ctrl-clicking
 * the open item closes it.
 */
export function ListItem({
  gistId,
  filename,
  isOpen,
  compact = false,
  action,
  children,
}: {
  gistId: string;
  filename?: string;
  isOpen: boolean;
  compact?: boolean;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Link
        ref={isOpen ? scrollIntoView : undefined}
        to="/{-$gistId}/{-$filePath}"
        params={{ gistId, filePath: filename }}
        search={({ view }) => ({ view })}
        onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey) {
            // (Even if the item's already open, e.g. to return to it from the mobile gist list)
            closeMobilePanels();
          } else if (isOpen) {
            event.preventDefault();
            openFile();
          }
        }}
        className={cn(
          "block min-w-0 text-left pr-10 rounded-lg transition-colors",
          compact ? "py-1.5 pl-2" : "py-3 pl-3",
          isOpen ? "raised" : "hover:bg-foreground/5",
        )}
      >
        {children}
      </Link>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex">{action}</div>
    </div>
  );
}
