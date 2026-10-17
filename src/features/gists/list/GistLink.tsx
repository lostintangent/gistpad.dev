import { prepareToOpenDocument, useOpenDocument } from "@/features/editor/document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { cn } from "cn";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Scrolls the selected gist into view, whenever it's (newly) selected. */
const scrollIntoView = (element: HTMLElement | null) =>
  element?.scrollIntoView({ behavior: "smooth", block: "center" });

/**
 * A link that opens a gist (file) from the gist list. Since it's a real link, the gist is
 * preloaded when hovered, and can be opened in a new tab. And Cmd/Ctrl-clicking the
 * selected gist deselects it.
 */
export function GistLink({
  gistId,
  filename,
  isSelected,
  className,
  children,
}: {
  gistId: string;
  filename?: string;
  isSelected: boolean;
  className?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const openDocument = useOpenDocument();

  return (
    <Link
      ref={isSelected ? scrollIntoView : undefined}
      to="/{-$gistId}/{-$filePath}"
      params={{ gistId, filePath: filename }}
      search={({ view }) => ({ view })}
      onClick={(event) => {
        if (!event.metaKey && !event.ctrlKey) {
          prepareToOpenDocument(isMobile);
        } else if (isSelected) {
          event.preventDefault();
          openDocument();
        }
      }}
      className={cn(
        "block flex-1 min-w-0 text-left p-3 rounded-lg transition-colors group",
        isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        className,
      )}
    >
      {children}
    </Link>
  );
}
