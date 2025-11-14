import CreateGistDialog from "@/components/dialogs/CreateGistDialog";
import DeleteDailyNoteDialog from "@/components/dialogs/DeleteDailyNoteDialog";
import DeleteGistDialog from "@/components/dialogs/DeleteGistDialog";
import { DailyNotes } from "@/components/list/DailyNotes";
import { GistListItem } from "@/components/list/GistListItem";
import { SubList } from "@/components/list/SubList";
import { TagFilter } from "@/components/list/TagFilter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useMobile";
import { ResearchTask } from "@/hooks/useUserSession";
import { Gist } from "@/lib/github";
import { isDateBasedGist } from "@/lib/utils";
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
import { useEffect, useMemo, useRef, useState } from "react";

interface GistListProps {
  gists: Gist[];
  starredGists: Gist[];
  archivedGists: Gist[];
  dailyNotes: Gist | null;
  selectedGistId: string | null;
  onSelectGist: (gist: Gist, filename?: string) => void;
  onDelete?: (gistId: string, filename?: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  selectedFile?: string;
  onStarToggle?: (gistId: string) => Promise<void>;
  onArchiveToggle?: (gistId: string) => Promise<void>;
  onPinToggle?: (gistId: string) => Promise<void>;
  pinnedGists?: string[];
  onDuplicateGist?: (gistId: string) => Promise<void>;
  onCreateGist?: (
    description: string,
    content?: string,
    isPublic?: boolean,
    selectedTags?: string[]
  ) => Promise<void>;
  onOpenTodaysNote?: () => Promise<void>;
  showArchivedGists?: boolean;
  showStarredGists?: boolean;
  onViewFullscreen?: (gistId: string) => void;
  onOpenDailyTemplate?: () => void;
  tags: Record<string, { name: string; color: string }>;
  gistTags: Record<string, string[]>;
  filterTagIds: string[];
  onFilterTagIdsChange: (ids: string[]) => void;
  onEditTags: () => void;
  onDeleteTag: (id: string) => void;
  onToggleTag?: (gistId: string, tagId: string, selected: boolean) => void;
  researchTasks: ResearchTask[];
  hasUnsavedChanges?: boolean;
}

function GistList({
  gists,
  starredGists,
  archivedGists,
  dailyNotes,
  selectedGistId,
  selectedFile,
  onSelectGist,
  onDelete,
  onToggleCollapse,
  isLoading = false,
  onRefresh,
  onStarToggle,
  onArchiveToggle,
  onPinToggle,
  pinnedGists = [],
  onDuplicateGist,
  onCreateGist,
  onOpenTodaysNote,
  showArchivedGists = false,
  showStarredGists = true,
  onViewFullscreen,
  onOpenDailyTemplate,
  tags,
  gistTags,
  filterTagIds,
  onFilterTagIdsChange,
  onEditTags,
  onDeleteTag,
  onToggleTag,
  researchTasks,
  hasUnsavedChanges = false,
}: GistListProps) {
  const [filter, setFilter] = useState("");
  const [gistToDelete, setGistToDelete] = useState<Gist | null>(null);
  const [dailyToDelete, setDailyToDelete] = useState<{
    gist: Gist;
    filename: string;
  } | null>(null);

  const selectedGistRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(gistTags).forEach((tagIds) => {
      tagIds.forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [gistTags]);

  // Clear the filter whenever the user
  // refreshes the gist list.
  useEffect(() => {
    if (isLoading) {
      setFilter("");
    }
  }, [isLoading]);

  // Scroll the selected gist into view (desktop only)
  useEffect(() => {
    if (isLoading || !selectedGistRef.current || !selectedGistId)
      return;

    selectedGistRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [isLoading, selectedGistId, selectedGistRef?.current]);

  // TODO: The following filters may be worth memoizing
  // in the future, but I don't think it's worth it right now
  // since most people don't have huge amounts of Gists.
  const matchesTags = (gistId: string) =>
    filterTagIds.every((t) => (gistTags[gistId] || []).includes(t));

  const filteredGists = gists.filter(
    (gist) =>
      (gist.description?.toLowerCase().includes(filter.toLowerCase()) ||
        !filter ||
        selectedGistId === gist.id) &&
      matchesTags(gist.id)
  );

  // Separate pinned gists from regular gists
  const pinnedGistsList = filteredGists.filter((gist) =>
    pinnedGists.includes(gist.id)
  );
  const unpinnedGistsList = filteredGists.filter(
    (gist) => !pinnedGists.includes(gist.id)
  );

  const filteredArchivedGists = archivedGists.filter(
    (gist) =>
      (gist.description?.toLowerCase().includes(filter.toLowerCase()) ||
        !filter ||
        selectedGistId === gist.id) &&
      matchesTags(gist.id)
  );

  const filteredStarredGists = starredGists.filter(
    (gist) =>
      (gist.description?.toLowerCase().includes(filter.toLowerCase()) ||
        !filter ||
        selectedGistId === gist.id) &&
      matchesTags(gist.id)
  );

  // Note: The timeout is due to an odd bug between
  // Radix drop down menus and dialogs.
  const handleDelete = async (gist: Gist) => {
    setTimeout(() => setGistToDelete(gist), 200);
  };

  const handleDeleteDailyFile = async (
    e: React.MouseEvent,
    gist: Gist,
    filename: string
  ) => {
    e.stopPropagation();
    setDailyToDelete({ gist, filename });
  };

  const confirmDelete = async () => {
    if (!gistToDelete) return;

    onDelete?.(gistToDelete.id);
    setGistToDelete(null);
  };

  const confirmDailyDelete = async () => {
    if (!dailyToDelete) return;
    const { gist, filename } = dailyToDelete;

    onDelete?.(gist.id, filename);
    setDailyToDelete(null);
  };

  const isFileSelected = (gistId: string, filename?: string) => {
    return (
      gistId === selectedGistId && (filename ? filename === selectedFile : true)
    );
  };

  const getMdFileCount = (gist: Gist) => {
    const fileCount = Object.values(gist.files).filter(({ filename }) =>
      filename.endsWith(".md")
    ).length;

    // TODO: Make this more general and add it to the date utils.
    if (isDateBasedGist(gist) && gist.files["README.md"]) return fileCount - 1;

    return fileCount;
  };

  const handleSelectGist = (gist, isDeselect: boolean) => {
    if (gist.id === selectedGistId && isDeselect) {
      onSelectGist(null);
    } else {
      onSelectGist(gist);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">

      {/* Header */}
      <div className="border-b p-3 flex-none bg-muted/30">
        <div className="flex items-center gap-3">
          <TagFilter
            tags={tags}
            selected={filterTagIds}
            tagCounts={tagCounts}
            onChange={onFilterTagIdsChange}
            onEditTags={() => onEditTags()}
            onDeleteTag={onDeleteTag}
          />
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Filter gists (${filterTagIds.length > 0 ? filteredGists.length : gists.length})`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setFilter("")}
              className="h-8 pl-8"
              disabled={
                isLoading ||
                gists.length === 0 ||
                (filterTagIds.length > 0 && filteredGists.length === 0)
              }
            />
            {filter && (
              <button
                onClick={() => setFilter("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Clear filter"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh gists"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            {(!isMobile && onToggleCollapse) && (
              <Button
                variant="ghost"
                onClick={onToggleCollapse}
                size="sm"
                title="Collapse sidebar"
              >
                <PanelLeftClose />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main gists List */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Main gists List */}
        <ScrollArea className="flex-1 min-h-0 [&>div>div]:block!">
          <div className="p-2 space-y-0.5">
            {isLoading ? (
              <>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="flex gap-4 items-center mb-4">
                    <div className="flex-1 p-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8 mr-2" />
                  </div>
                ))}
              </>
            ) : filteredGists.length === 0 &&
              !filter &&
              filterTagIds.length === 0 ? (
              <div className="p-4">
                <p className="mb-6 text-center">
                  You don't appear to have any gists...yet!
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenTodaysNote}
                    title="Open today's note"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <CreateGistDialog onSubmit={onCreateGist} />
                </div>
              </div>
            ) : filteredGists.length === 0 &&
              (filter || filterTagIds.length > 0) ? (
              <div className="text-center text-muted-foreground italic text-sm mt-4">
                No gists match your filter
              </div>
            ) : (
              <>
                {/* Pinned gists at the top */}
                {pinnedGistsList.length > 0 && (
                  <>
                    {pinnedGistsList.map((gist) => (
                      <GistListItem
                        key={gist.id}
                        gist={gist}
                        isPinned={true}
                        isSelected={isFileSelected(gist.id)}
                        selectedRef={
                          gist.id === selectedGistId
                            ? selectedGistRef
                            : undefined
                        }
                        onSelectGist={handleSelectGist}
                        onPinToggle={onPinToggle}
                        onDuplicateGist={onDuplicateGist}
                        onArchiveToggle={onArchiveToggle}
                        onViewFullscreen={onViewFullscreen}
                        onDelete={handleDelete}
                        getMdFileCount={getMdFileCount}
                        researchTasks={researchTasks}
                        hasUnsavedChanges={hasUnsavedChanges}
                        tagIds={gistTags[gist.id]}
                        tags={tags}
                        onEditTags={onEditTags}
                        onToggleTag={onToggleTag}
                      />
                    ))}
                  </>
                )}

                {/* Regular unpinned gists */}
                {unpinnedGistsList.map((gist) => (
                  <GistListItem
                    key={gist.id}
                    gist={gist}
                    isPinned={false}
                    isSelected={isFileSelected(gist.id)}
                    selectedRef={
                      gist.id === selectedGistId ? selectedGistRef : undefined
                    }
                    onSelectGist={handleSelectGist}
                    onPinToggle={onPinToggle}
                    onDuplicateGist={onDuplicateGist}
                    onArchiveToggle={onArchiveToggle}
                    onViewFullscreen={onViewFullscreen}
                    onDelete={handleDelete}
                    getMdFileCount={getMdFileCount}
                    researchTasks={researchTasks}
                    hasUnsavedChanges={hasUnsavedChanges}
                    tagIds={gistTags[gist.id]}
                    tags={tags}
                    onEditTags={onEditTags}
                    onToggleTag={onToggleTag}
                  />
                ))}

                {(filter || filterTagIds.length > 0) &&
                  filteredGists.length > 0 && (
                    <div className="text-center text-muted-foreground italic text-sm pt-4">
                      {`Showing ${filteredGists.length} of ${gists.length} gists`}
                    </div>
                  )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Daily notes */}
        {!isLoading && (
          <DailyNotes
            dailyNotes={dailyNotes}
            onSelectGist={onSelectGist}
            onDeleteFile={handleDeleteDailyFile}
            selectedGistId={selectedGistId}
            selectedFile={selectedFile}
            onOpenTemplate={onOpenDailyTemplate}
          />
        )}

        {/* Starred gists */}
        {starredGists.length > 0 && showStarredGists && (
          <SubList
            gists={starredGists}
            filteredGists={filteredStarredGists}
            icon={
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 mr-1" />
            }
            sectionKey="starred"
            renderGistAction={(gist) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onStarToggle?.(gist.id);
                }}
                className="shrink-0 h-8 w-8 p-0"
                title="Unstar gist"
              >
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              </Button>
            )}
            onSelectGist={onSelectGist}
            isFileSelected={isFileSelected}
            filter={filter}
            getMdFileCount={getMdFileCount}
            showAvatar={true}
            showPublicBadge={false}
            selectedGistId={selectedGistId}
          />
        )}

        {/* Archived gists */}
        {!isLoading && archivedGists.length > 0 && showArchivedGists && (
          <SubList
            gists={archivedGists}
            filteredGists={filteredArchivedGists}
            icon={<Archive className="h-3.5 w-3.5 text-slate-500 mr-1" />}
            sectionKey="archived"
            renderGistAction={(gist) => (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 w-8 p-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onArchiveToggle?.(gist.id)}>
                    <ArchiveRestore className="h-4 w-4 mr-2 text-slate-500" />
                    Unarchive gist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      handleDelete(gist);
                    }}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete gist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            onSelectGist={onSelectGist}
            isFileSelected={isFileSelected}
            filter={filter}
            getMdFileCount={getMdFileCount}
            selectedGistId={selectedGistId}
          />
        )}
      </div>

      <DeleteGistDialog
        isOpen={!!gistToDelete}
        onOpenChange={(open) => !open && setGistToDelete(null)}
        onConfirm={confirmDelete}
        gistDescription={
          gistToDelete?.description?.replace(/\s*\[Archived\]$/, "") || ""
        }
      />

      <DeleteDailyNoteDialog
        open={!!dailyToDelete}
        onOpenChange={(open) => !open && setDailyToDelete(null)}
        onConfirm={confirmDailyDelete}
        filename={dailyToDelete?.filename.replace(/\.md$/, "") || ""}
      />
    </Card >
  );
}

export default GistList;
