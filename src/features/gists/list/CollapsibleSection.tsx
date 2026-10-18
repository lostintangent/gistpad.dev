import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { persistedAtom } from "@/shared/persistedAtom";
import { useActiveFile } from "@/features/files/file";
import { useAtom } from "@tanstack/react-store";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

const sectionCollapsedAtoms = {
  daily: persistedAtom("gistpad-daily-collapsed", true),
  starred: persistedAtom("gistpad-starred-collapsed", true),
  archived: persistedAtom("gistpad-archived-collapsed", true),
};

interface CollapsibleSectionProps {
  section: keyof typeof sectionCollapsedAtoms;
  icon: ReactNode;
  title: string;
  /** The number of gists (or notes) in the section, which is shown at the end of its header. */
  count: ReactNode;
  /** Shown in the header, while the section is collapsed (e.g. a summary). */
  collapsedDetails?: ReactNode;
  /** Shown in the header (before its count), while the section is expanded. */
  actions?: ReactNode;
  /** Whether the open gist is in this section (which expands it, even if it's collapsed). */
  containsOpenGist: boolean;
  /** The number of rows in the section (which it's sized to fit, up to a limit). */
  rowCount: number;
  children: ReactNode;
}

// Sections show up to a few (compact) rows, and scroll beyond that, so the gist list keeps its room
const ROW_HEIGHT = 34;
const MAX_ROWS = 5;

/** A collapsible section of the gist list, which remembers whether the user collapsed it. */
export function CollapsibleSection({
  section,
  icon,
  title,
  count,
  collapsedDetails,
  actions,
  containsOpenGist,
  rowCount,
  children,
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useAtom(sectionCollapsedAtoms[section]);
  const { gistId: openGistId } = useActiveFile();

  // Expand the section when one of its gists is opened, until the user explicitly collapses it.
  const [dismissedGistId, setDismissedGistId] = useState<string>();
  const isExpanded = !isCollapsed || (containsOpenGist && openGistId !== dismissedGistId);

  const toggle = () => {
    setIsCollapsed(isExpanded);
    setDismissedGistId(isExpanded ? openGistId : undefined);
  };

  // The section spans the sidebar, and its header and rows are inset within it, so that its scroll
  // area doesn't clip the border (and shadow) of its selected row
  return (
    <div className="flex-none">
      <div className="mx-2 pl-1 pr-2 py-2 flex items-center gap-1 rounded-lg hover:bg-foreground/5 transition-colors">
        <button className="flex items-center gap-2 grow" onClick={toggle}>
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 [&>svg]:size-3.5 [&>svg]:mr-1">
            {icon}
            {title}
            {!isExpanded && collapsedDetails}
          </span>
          {/* (A rule from the title to the header's end, which separates the sections) */}
          <span aria-hidden className="mr-1 h-px flex-1 bg-border" />
        </button>
        {isExpanded && actions}
        {/* (Last in the header, so that the sections' counts line up) */}
        <Badge variant="count">{count}</Badge>
      </div>
      <div
        className="transition-[height,opacity] duration-200 ease-in-out overflow-hidden"
        style={{
          height: isExpanded ? Math.min(Math.max(rowCount, 1), MAX_ROWS) * ROW_HEIGHT + 8 : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        // Collapsed sections are hidden from keyboard and screen reader users too
        inert={!isExpanded}
      >
        <ScrollArea className="h-full">
          <div className="py-1 pl-3 pr-2 space-y-0.5">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
