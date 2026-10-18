import CreateGistButton from "../CreateGistButton";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shared/ui/input-group";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Skeleton } from "@/shared/ui/skeleton";
import { useOpenTodaysNote } from "../actions";
import type { Gist } from "@/shared/github";
import { useGists, useStarredGists } from "../queries";
import { usePreferences } from "@/features/account/queries";
import { useDocument } from "@/features/editor/document";
import { createAtom, useAtom } from "@tanstack/react-store";
import { Calendar, Tag, X } from "lucide-react";
import type { ReactNode } from "react";
import { DailyNotes } from "./DailyNotes";
import { GistItem } from "./GistItem";
import { GistSection } from "./GistSection";
import { TagMenuItems } from "../tags";

/**
 * The gist list's filter, which matches gists whose description includes its text, and that have
 * all of its tags. (It outlives the list, so it's kept when the sidebar is closed, or swapped for
 * zen mode's.)
 */
const filterAtom = createAtom({ text: "", tagIds: [] as string[] });

/** The sidebar's gists, beneath a header for filtering them (and creating new ones). */
export default function GistList({
  leadingSlot,
}: {
  /** The header's first item (e.g. the sidebar's collapse toggle, or a space for it). */
  leadingSlot?: ReactNode;
}) {
  const { gists, archivedGists, dailyNotes, isPending } = useGists();
  const starredGists = useStarredGists();
  const { tags, gistTags, pinnedGists, showArchivedGists, showStarredGists } = usePreferences();
  const { gistId: openGistId } = useDocument();
  const openTodaysNote = useOpenTodaysNote();

  const [filter, setFilter] = useAtom(filterAtom);
  const updateFilter = (changes: Partial<typeof filter>) =>
    setFilter((filter) => ({ ...filter, ...changes }));

  // (Tags that have since been deleted are ignored)
  const tagIds = filter.tagIds.filter((id) => tags[id]);
  const isFiltered = !!filter.text || tagIds.length > 0;

  // The open gist is always listed (e.g. so it doesn't disappear as it's renamed, or untagged)
  const matchesFilter = (gist: Gist) =>
    gist.id === openGistId ||
    ((gist.description ?? "").toLowerCase().includes(filter.text.toLowerCase()) &&
      tagIds.every((id) => gistTags[gist.id]?.includes(id)));

  // Pinned gists are listed first
  const filterGists = (gists: Gist[]) =>
    gists
      .filter(matchesFilter)
      .toSorted((a, b) => Number(pinnedGists.includes(b.id)) - Number(pinnedGists.includes(a.id)));
  const filteredGists = filterGists(gists);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="px-2 py-3 flex-none flex items-center gap-2">
        {leadingSlot}
        <InputGroup className="h-8 flex-1 bg-card" data-disabled={gists.length === 0}>
          <InputGroupAddon>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <InputGroupButton
                    aria-label="Filter by tag"
                    className={tagIds.length > 0 ? "bg-muted text-foreground" : ""}
                  />
                }
              >
                <Tag />
                {tagIds.length > 0 && tagIds.length}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <TagMenuItems
                  tagIds={tagIds}
                  onChange={(tagIds) => updateFilter({ tagIds })}
                  canManage
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Filter gists"
            value={filter.text}
            onChange={(e) => updateFilter({ text: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && updateFilter({ text: "" })}
            disabled={gists.length === 0}
            // The tag button has its own padding, so the input only needs some when
            // the button is filled in (i.e. it's showing the selected tag count)
            className={tagIds.length > 0 ? "pl-1.5!" : "pl-0!"}
          />
          <InputGroupAddon align="inline-end">
            <Badge variant="count">
              {isFiltered ? `${filteredGists.length} of ${gists.length}` : gists.length}
            </Badge>
            {filter.text && (
              <InputGroupButton
                size="icon-xs"
                onClick={() => updateFilter({ text: "" })}
                aria-label="Clear filter"
              >
                <X />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
        <CreateGistButton />
      </div>

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
            filteredGists.map((gist) => (
              <GistItem key={gist.id} gist={gist} isOpen={gist.id === openGistId} />
            ))
          )}
        </div>
      </ScrollArea>

      {dailyNotes && <DailyNotes dailyNotes={dailyNotes} />}

      {showStarredGists && starredGists.length > 0 && (
        <GistSection
          section="starred"
          gists={filterGists(starredGists)}
          totalCount={starredGists.length}
          isFiltered={isFiltered}
        />
      )}

      {showArchivedGists && archivedGists.length > 0 && (
        <GistSection
          section="archived"
          gists={filterGists(archivedGists)}
          totalCount={archivedGists.length}
          isFiltered={isFiltered}
        />
      )}
    </div>
  );
}
