import { ScrollableText } from "@/components/ScrollableText";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/useMobile";
import { getGistDisplayName, Gist } from "@/lib/github";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, File, Globe, MessageSquare } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

interface SubListProps {
  gists: Gist[];
  filteredGists: Gist[];

  icon: ReactNode;
  sectionKey: string;
  showAvatar?: boolean;
  showPublicBadge?: boolean;

  renderGistAction: (gist: Gist) => ReactNode;
  onSelectGist: (gist: Gist, filename?: string) => void;
  isFileSelected: (gistId: string, filename?: string) => boolean;
  filter: string;
  getMdFileCount: (gist: Gist) => number;
  selectedGistId: string | null;
}

export function SubList({
  gists,
  filteredGists,
  icon,
  sectionKey,
  renderGistAction,
  onSelectGist,
  isFileSelected,
  filter,
  getMdFileCount,
  showAvatar = false,
  showPublicBadge = true,
  selectedGistId,
}: SubListProps) {
  const title = `${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)} gists`;
  const emptyFilterMessage = `No ${sectionKey} gists match your filter`;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(`gistpad-${sectionKey}-collapsed`);
    return saved ? JSON.parse(saved) : true;
  });

  const isMobile = useIsMobile();
  const selectedGistRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(
      `gistpad-${sectionKey}-collapsed`,
      JSON.stringify(isCollapsed)
    );
  }, [isCollapsed, sectionKey]);

  // Auto-expand section when a gist it "owns" is selected
  useEffect(() => {
    if (isMobile) return;

    if (selectedGistId && gists.some((gist) => gist.id === selectedGistId)) {
      setIsCollapsed(false);

      selectedGistRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedGistId, gists, isMobile, selectedGistRef.current]);

  return (
    <div className="flex-none border-t">
      {/* Header */}
      <button
        className={`w-full p-2 flex items-center bg-muted/30 hover:bg-muted/60 transition-colors ${isCollapsed ? "" : "border-b"}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <div
            className="transition-transform duration-200"
            style={{
              transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </div>
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            {icon}
            <span>
              {title} (
              {filter
                ? `${filteredGists.length} of ${gists.length}`
                : gists.length}
              )
            </span>
          </div>
        </div>
      </button>

      {/* Scrollable list area */}
      <div
        className={`transition-[height,opacity] duration-200 ease-in-out overflow-hidden ${isCollapsed
            ? "h-0 opacity-0"
            : filteredGists.length === 1
              ? "h-[80px] opacity-100"
              : "h-[150px] opacity-100"
          }`}
      >
        <ScrollArea className="h-full [&>div>div]:block!">
          <div className="p-2 space-y-1">
            {filteredGists.length === 0 && filter ? (
              <div className="p-2 text-muted-foreground text-center italic text-sm">
                {emptyFilterMessage}
              </div>
            ) : (
              filteredGists.map((gist) => (
                <div
                  key={gist.id}
                  className="flex items-center gap-2"
                  ref={gist.id === selectedGistId ? selectedGistRef : null}
                >
                  <button
                    onClick={() => onSelectGist(gist)}
                    className={`flex-1 text-left p-3 rounded-lg transition-colors max-w-[calc(100%-3rem)] group ${isFileSelected(gist.id)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                      }`}
                  >
                    {showAvatar ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={gist.owner?.avatar_url}
                            alt={gist.owner?.login}
                          />
                          <AvatarFallback>
                            {gist.owner?.login?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="max-w-[calc(100%-2.1rem)]">
                          <h3 className="font-medium">
                            <ScrollableText>
                              {getGistDisplayName(gist)}
                            </ScrollableText>
                          </h3>
                          <ScrollableText>
                            <div className="text-sm text-muted-foreground flex items-center space-x-2">
                              <span>
                                {formatDistanceToNow(
                                  new Date(gist.updated_at),
                                  {
                                    addSuffix: true,
                                  }
                                )}
                              </span>
                              {showPublicBadge && gist.public && (
                                <Badge
                                  variant="secondary"
                                  className="mt-[3px]"
                                  title="Public gist"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                </Badge>
                              )}
                              {getMdFileCount(gist) > 1 && (
                                <Badge
                                  variant="secondary"
                                  className="mt-[3px]"
                                  title={`${getMdFileCount(gist)} files`}
                                >
                                  {getMdFileCount(gist)}
                                  <File className="ml-1 h-3.5 w-3.5" />
                                </Badge>
                              )}
                              {gist.comments > 0 && (
                                <Badge variant="secondary" className="mt-[3px]">
                                  {gist.comments}
                                  <MessageSquare className="ml-1 h-3.5 w-3.5" />
                                </Badge>
                              )}
                            </div>
                          </ScrollableText>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium">
                          <ScrollableText>
                            {getGistDisplayName(gist)}
                          </ScrollableText>
                        </h3>
                        <div className="text-sm text-muted-foreground truncate flex items-center gap-2">
                          {formatDistanceToNow(new Date(gist.updated_at), {
                            addSuffix: true,
                          })}
                          {showPublicBadge && gist.public && (
                            <Badge
                              variant="secondary"
                              className="mt-[3px]"
                              title="Public gist"
                            >
                              <Globe className="h-3.5 w-3.5" />
                            </Badge>
                          )}
                          {getMdFileCount(gist) > 1 && (
                            <Badge
                              variant="secondary"
                              className="mt-[3px]"
                              title={`${getMdFileCount(gist)} files`}
                            >
                              {getMdFileCount(gist)}
                              <File className="ml-1 h-3.5 w-3.5" />
                            </Badge>
                          )}
                          {gist.comments > 0 && (
                            <Badge variant="secondary" className="mt-[3px]">
                              {gist.comments}
                              <MessageSquare className="ml-1 h-3.5 w-3.5" />
                            </Badge>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                  {renderGistAction(gist)}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
