import { Badge } from "@/shared/ui/badge";
import { ScrollableText } from "@/shared/ScrollableText";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import { GistLink } from "./GistLink";
import { GistMetadata } from "./GistMetadata";

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
      height={gists.length === 1 ? 80 : 150}
    >
      <ScrollArea className="h-full">
        <div className="p-2 space-y-1">
          {gists.length === 0 ? (
            <div className="p-2 text-muted-foreground text-center italic text-sm">
              No {section} gists match your filter
            </div>
          ) : (
            gists.map((gist) => (
              <div key={gist.id} className="flex items-center gap-2">
                <GistLink
                  gistId={gist.id}
                  isSelected={gist.id === openGistId}
                  className="max-w-[calc(100%-3rem)]"
                >
                  <div className="flex items-center gap-2">
                    {isStarred && (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={gist.owner?.avatar_url} alt={gist.owner?.login} />
                        <AvatarFallback>{gist.owner?.login[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">
                        <ScrollableText>{getGistDisplayName(gist)}</ScrollableText>
                      </h3>
                      <ScrollableText>
                        <GistMetadata gist={gist} showPublicBadge={!isStarred} />
                      </ScrollableText>
                    </div>
                  </div>
                </GistLink>
                {renderAction(gist)}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </CollapsibleSection>
  );
}
