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
  showOwner = false,
  renderAction,
}: {
  section: "starred" | "archived";
  icon: ReactNode;
  /** The gists that match the current filter. */
  gists: Gist[];
  totalCount: number;
  isFiltered: boolean;
  /** Whether to show who owns each gist (e.g. for starred gists). */
  showOwner?: boolean;
  renderAction: (gist: Gist) => ReactNode;
}) {
  const { gistId: openGistId } = useParams({ strict: false });

  return (
    <CollapsibleSection
      section={section}
      title={
        <>
          {icon}
          {section === "starred" ? "Starred" : "Archived"} gists (
          {isFiltered ? `${gists.length} of ${totalCount}` : totalCount})
        </>
      }
      openGistId={gists.some(({ id }) => id === openGistId) ? openGistId : undefined}
      height={gists.length === 1 ? 80 : 150}
    >
      <ScrollArea className="h-full">
        <div className="p-2 space-y-1">
          {gists.length === 0 && isFiltered ? (
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
                    {showOwner && (
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
                        <GistMetadata gist={gist} showPublicBadge={!showOwner} />
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
