import { Badge } from "@/shared/ui/badge";
import { ScrollableText } from "@/shared/ScrollableText";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import { GistRow } from "./GistLink";

/** A secondary list of gists (e.g. starred or archived gists), below the user's main gists. */
export function GistSection({
  section,
  icon,
  gists,
  totalCount,
  isFiltered,
  renderAction,
}: {
  section: "starred" | "archived";
  icon: ReactNode;
  /** The gists that match the current filter. */
  gists: Gist[];
  totalCount: number;
  isFiltered: boolean;
  renderAction: (gist: Gist) => ReactNode;
}) {
  const { gistId: openGistId } = useParams({ strict: false });
  // Starred gists can belong to anyone, so they show who owns them (rather than if they're public).
  const isStarred = section === "starred";

  return (
    <CollapsibleSection
      section={section}
      title={
        <>
          {icon}
          {isStarred ? "Starred" : "Archived"} gists
          <Badge variant="count">
            {isFiltered ? `${gists.length} of ${totalCount}` : totalCount}
          </Badge>
        </>
      }
      openGistId={gists.some(({ id }) => id === openGistId) ? openGistId : undefined}
      rowCount={gists.length}
    >
      <ScrollArea className="h-full">
        <div className="py-1 pl-3 pr-2 space-y-0.5">
          {gists.length === 0 ? (
            <div className="p-2 text-muted-foreground text-center italic text-sm">
              No {section} gists match your filter
            </div>
          ) : (
            gists.map((gist) => (
              <GistRow
                key={gist.id}
                gistId={gist.id}
                isSelected={gist.id === openGistId}
                action={renderAction(gist)}
                className="py-1.5 px-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  {isStarred && (
                    <Avatar className="size-5">
                      <AvatarImage src={gist.owner?.avatar_url} alt={gist.owner?.login} />
                      <AvatarFallback>{gist.owner?.login[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <ScrollableText className="flex-1">{getGistDisplayName(gist)}</ScrollableText>
                </div>
              </GistRow>
            ))
          )}
        </div>
      </ScrollArea>
    </CollapsibleSection>
  );
}
