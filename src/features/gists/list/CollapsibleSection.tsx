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
  /** The height of the expanded section. */
  height: number;
  children: ReactNode;
}

/** A collapsible section of the gist list, which remembers whether the user collapsed it. */
export function CollapsibleSection({
  section,
  title,
  collapsedDetails,
  actions,
  openGistId,
  height,
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

  return (
    <div className="flex-none border-t">
      <div
        className={`w-full p-2 flex items-center bg-muted/30 hover:bg-muted/60 transition-colors ${isOpen ? "border-b" : ""}`}
      >
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
        style={{ height: isOpen ? height : 0, opacity: isOpen ? 1 : 0 }}
        // Collapsed sections are hidden from keyboard and screen reader users too
        inert={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}
