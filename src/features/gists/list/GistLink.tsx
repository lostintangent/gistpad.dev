import { prepareToOpenDocument, useOpenDocument } from "@/features/editor/document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { cn } from "cn";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Scrolls the selected gist into view, whenever it's (newly) selected. */
const scrollIntoView = (element: HTMLElement | null) =>
  element?.scrollIntoView({ behavior: "smooth", block: "center" });

interface GistLinkProps {
  gistId: string;
  filename?: string;
  isSelected: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A link that opens a gist (file) from the gist list. Since it's a real link, the gist is
 * preloaded when hovered, and can be opened in a new tab. And Cmd/Ctrl-clicking the
 * selected gist deselects it.
 */
function GistLink({ gistId, filename, isSelected, className, children }: GistLinkProps) {
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
        "block min-w-0 text-left p-3 rounded-lg transition-colors group",
        isSelected ? "raised" : "hover:bg-foreground/5",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A row in the gist list: a link, with an (optional) action that's overlaid on its right edge, so
 * that the whole row is highlighted together (e.g. while it's selected).
 */
export function GistRow({ action, ...props }: GistLinkProps & { action?: ReactNode }) {
  return (
    <div className="relative">
      <GistLink {...props} className={cn(props.className, action && "pr-10")} />
      {action && <div className="absolute right-2 top-1/2 -translate-y-1/2 flex">{action}</div>}
    </div>
  );
}
