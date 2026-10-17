import CreateGistButton from "../CreateGistButton";
import { deleteGistDialog } from "../dialogs/DeleteGistDialog";
import EditTagsDialog from "../dialogs/EditTagsDialog";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shared/ui/input-group";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Skeleton } from "@/shared/ui/skeleton";
import { useOpenTodaysNote } from "../actions";
import { useIsMobile } from "@/shared/useMediaQuery";
import type { Gist } from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import { useGists, useStarredGists, useToggleArchived, useToggleStarred } from "../queries";
import { usePreferences } from "@/features/session/queries";
import { tagFiltersAtom } from "../store";
import { useParams } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  MoreHorizontal,
  PanelLeftClose,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { DailyNotes } from "./DailyNotes";
import { GistListItem } from "./GistListItem";
import { GistSection } from "./GistSection";
import { TagFilter } from "./TagFilter";

export default function GistList({ onCollapse }: { onCollapse?: () => void }) {
  const { gists, archivedGists, dailyNotes, isPending, isFetching } = useGists();
  const starredGists = useStarredGists();
  const { pinnedGists, gistTags, showArchivedGists, showStarredGists } = usePreferences();
  const { gistId: openGistId } = useParams({ strict: false });
  const tagFilters = useSelector(tagFiltersAtom);
  const isMobile = useIsMobile();

  const [filter, setFilter] = useState("");
  const openTodaysNote = useOpenTodaysNote();
  const { mutate: toggleArchived } = useToggleArchived();
  const { mutate: toggleStarred } = useToggleStarred();

  const isFiltered = !!filter || tagFilters.length > 0;
  const matchesFilter = (gist: Gist) =>
    (gist.id === openGistId ||
      !filter ||
      !!gist.description?.toLowerCase().includes(filter.toLowerCase())) &&
    tagFilters.every((tagId) => gistTags[gist.id]?.includes(tagId));

  // Pinned gists are listed first
  const filteredGists = gists
    .filter(matchesFilter)
    .toSorted((a, b) => Number(pinnedGists.includes(b.id)) - Number(pinnedGists.includes(a.id)));

  const refresh = () => {
    setFilter("");
    queryClient.invalidateQueries({ queryKey: ["gists"] });
  };

  return (
    <Card className="w-full h-full flex flex-col gap-0 py-0">
      {/* Header */}
      <div className="border-b p-3 flex-none bg-muted/30">
        <div className="flex items-center gap-2">
          <InputGroup className="h-8 flex-1" data-disabled={isPending || gists.length === 0}>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={`Filter gists (${tagFilters.length > 0 ? filteredGists.length : gists.length})`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setFilter("")}
              disabled={isPending || gists.length === 0}
            />
            <InputGroupAddon align="inline-end">
              {filter && (
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => setFilter("")}
                  aria-label="Clear filter"
                >
                  <X />
                </InputGroupButton>
              )}
              <TagFilter />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={refresh}
              disabled={isFetching}
              title="Refresh gists"
            >
              <RefreshCw className={isFetching ? "animate-spin" : ""} />
            </Button>
            {!isMobile && onCollapse && (
              <Button variant="ghost" size="icon-sm" onClick={onCollapse} title="Collapse sidebar">
                <PanelLeftClose />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Gists */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-0.5">
            {isPending ? (
              Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex gap-4 items-center mb-4">
                  <div className="flex-1 p-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-8 mr-2" />
                </div>
              ))
            ) : gists.length === 0 ? (
              <div className="p-4">
                <p className="mb-6 text-center">You don't appear to have any gists...yet!</p>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openTodaysNote}
                    title="Open today's note"
                  >
                    <Calendar />
                  </Button>
                  <CreateGistButton />
                </div>
              </div>
            ) : filteredGists.length === 0 ? (
              <div className="text-center text-muted-foreground italic text-sm mt-4">
                No gists match your filter
              </div>
            ) : (
              <>
                {filteredGists.map((gist) => (
                  <GistListItem
                    key={gist.id}
                    gist={gist}
                    isPinned={pinnedGists.includes(gist.id)}
                    isSelected={gist.id === openGistId}
                  />
                ))}
                {isFiltered && (
                  <div className="text-center text-muted-foreground italic text-sm pt-4">
                    Showing {filteredGists.length} of {gists.length} gists
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {dailyNotes && <DailyNotes dailyNotes={dailyNotes} />}

        {showStarredGists && starredGists.length > 0 && (
          <GistSection
            section="starred"
            icon={<Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 mr-1" />}
            gists={starredGists.filter(matchesFilter)}
            totalCount={starredGists.length}
            isFiltered={isFiltered}
            showOwner
            renderAction={(gist) => (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => toggleStarred({ gist, isStarred: true })}
                className="shrink-0"
                title="Unstar gist"
              >
                <Star className="fill-yellow-400 text-yellow-400" />
              </Button>
            )}
          />
        )}

        {showArchivedGists && archivedGists.length > 0 && (
          <GistSection
            section="archived"
            icon={<Archive className="h-3.5 w-3.5 text-slate-500 mr-1" />}
            gists={archivedGists.filter(matchesFilter)}
            totalCount={archivedGists.length}
            isFiltered={isFiltered}
            renderAction={(gist) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toggleArchived(gist)}>
                    <ArchiveRestore className="text-slate-500" />
                    Unarchive gist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => deleteGistDialog.openWithPayload({ gist })}
                  >
                    <Trash2 />
                    Delete gist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        )}
      </div>

      <EditTagsDialog />
    </Card>
  );
}
