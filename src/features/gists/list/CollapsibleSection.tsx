import { persistedAtom } from "@/shared/persistedAtom";
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
  title: ReactNode;
  /** Shown in the header, while the section is collapsed (e.g. a summary). */
  collapsedDetails?: ReactNode;
  /** Shown in the header, while the section is expanded. */
  actions?: ReactNode;
  /** The ID of the open gist, if it's in this section (which reveals the section). */
  openGistId?: string;
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
  title,
  collapsedDetails,
  actions,
  openGistId,
  rowCount,
  children,
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useAtom(sectionCollapsedAtoms[section]);

  // Reveal the section when one of its gists is opened, until the user explicitly collapses it.
  const [dismissedGistId, setDismissedGistId] = useState<string>();
  const isOpen = !isCollapsed || (!!openGistId && openGistId !== dismissedGistId);

  const toggle = () => {
    setIsCollapsed(isOpen);
    setDismissedGistId(isOpen ? openGistId : undefined);
  };

  // The section spans the sidebar, and its header and rows are inset within it, so that its scroll
  // area doesn't clip the border (and shadow) of its selected row
  return (
    <div className="flex-none">
      <div className="mx-2 px-1 py-2 flex items-center rounded-lg hover:bg-foreground/5 transition-colors">
        <button className="flex items-center gap-2 grow" onClick={toggle}>
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          />
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            {title}
            {!isOpen && collapsedDetails}
          </span>
        </button>
        {isOpen && actions}
      </div>
      <div
        className="transition-[height,opacity] duration-200 ease-in-out overflow-hidden"
        style={{
          height: isOpen ? Math.min(Math.max(rowCount, 1), MAX_ROWS) * ROW_HEIGHT + 8 : 0,
          opacity: isOpen ? 1 : 0,
        }}
        // Collapsed sections are hidden from keyboard and screen reader users too
        inert={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}
