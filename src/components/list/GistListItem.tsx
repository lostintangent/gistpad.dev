import { isAiCommandInProgressAtom } from "@/atoms";
import { ScrollableText } from "@/components/ScrollableText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResearchTask } from "@/hooks/useUserSession";
import { Gist } from "@/lib/github";
import { isDateBasedGist } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAtomValue } from "jotai";
import {
  Archive,
  Calendar,
  Check,
  Copy,
  File,
  Fullscreen,
  Globe,
  Link,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { RefObject } from "react";
import TagBadge from "./TagBadge";

interface GistBadgeProps {
  children: React.ReactNode;
}

const GistBadge = ({ children }: GistBadgeProps) => {
  return (
    <Badge variant="secondary">
      {children}
    </Badge>
  );
};

interface GistListItemProps {
  gist: Gist;
  isPinned: boolean;
  isSelected: boolean;
  selectedRef?: RefObject<HTMLDivElement>;
  onSelectGist: (gist: Gist, isDeselect: boolean) => void;
  onPinToggle?: (gistId: string) => Promise<void>;
  onDuplicateGist?: (gistId: string) => Promise<void>;
  onArchiveToggle?: (gistId: string) => Promise<void>;
  onViewFullscreen?: (gistId: string) => void;
  onDelete: (gist: Gist) => void;
  getMdFileCount: (gist: Gist) => number;
  tagIds?: string[];
  tags?: Record<string, { name: string; color: string }>;
  onEditTags?: () => void;
  onToggleTag?: (gistId: string, tagId: string, selected: boolean) => void;
  researchTasks: ResearchTask[];
  hasUnsavedChanges?: boolean;
}

export function GistListItem({
  gist,
  isPinned,
  isSelected,
  selectedRef,
  onSelectGist,
  onPinToggle,
  onDuplicateGist,
  onArchiveToggle,
  onViewFullscreen,
  onDelete,
  getMdFileCount,
  tagIds = [],
  tags = {},
  onEditTags,
  onToggleTag,
  researchTasks,
  hasUnsavedChanges = false,
}: GistListItemProps) {
  const isAiCommandInProgress = useAtomValue(isAiCommandInProgressAtom);
  const hasInProgressResearchTask = researchTasks.some(
    (t) => t.gistId === gist.id && !t.content
  );
  const hasInProgressAiTask =
    hasInProgressResearchTask || (isAiCommandInProgress && isSelected);

  const hasUnseenTask = researchTasks.some(
    (t) => t.gistId === gist.id && t.content && !t.hasBeenSeen
  );
  const showBlueDot = hasUnseenTask || (hasUnsavedChanges && isSelected);

  let gistTitle;
  if (gist.description) {
    gistTitle = <>{gist.description}</>;
  } else {
    const firstFile = Object.keys(gist.files)[0]?.replace(".md", "");
    if (!firstFile) {
      gistTitle = (
        <span className="italic text-muted-foreground">
          Empty
        </span>
      );
    } else if (firstFile === "README") {
      gistTitle = (
        <span
          className={`italic${hasInProgressAiTask ? "" : " text-muted-foreground"}`}
        >
          Untitled
        </span>
      );
    } else {
      gistTitle = <>{firstFile}</>;
    }
  }

  return (
    <div className="flex items-center gap-2" ref={selectedRef}>
      <button
        onClick={(e) => onSelectGist(gist, e.metaKey || e.ctrlKey)}
        className={`flex-1 text-left p-3 rounded-lg transition-colors max-w-[calc(100%-3rem)] group ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
      >
        <h3 className="font-medium flex items-center gap-1">
          {isPinned && (
            <Tooltip>
              <TooltipTrigger>
                <Pin
                  className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary-foreground" : "text-purple-500 dark:text-purple-400"}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Pinned gist</p>
              </TooltipContent>
            </Tooltip>
          )}
          <ScrollableText>
            <span
              className={
                hasInProgressAiTask
                  ? "bg-linear-to-r from-green-400 to-purple-600 bg-clip-text text-transparent animate-gradient-pulse"
                  : ""
              }
            >
              {gistTitle}
            </span>
          </ScrollableText>
        </h3>

        <ScrollableText>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {showBlueDot && (
              <span className="bg-blue-500 rounded-full w-2 h-2" />
            )}
            {formatDistanceToNow(gist.updated_at, {
              addSuffix: true,
            })}
            {gist.public && (
              <GistBadge tooltip="Public gist">
                <Globe className="h-3.5 w-3.5" />
              </GistBadge>
            )}
            {(getMdFileCount(gist) > 1 || isDateBasedGist(gist)) && (
              <GistBadge tooltip={`${getMdFileCount(gist)} files`}>
                {getMdFileCount(gist)}
                {isDateBasedGist(gist) ? (
                  <Calendar className="ml-1 h-3.5 w-3.5" />
                ) : (
                  <File className="ml-1 h-3.5 w-3.5" />
                )}
              </GistBadge>
            )}
            {gist.comments > 0 && (
              <GistBadge tooltip={`${gist.comments} comments`}>
                {gist.comments}
                <MessageSquare className="ml-1 h-3.5 w-3.5" />
              </GistBadge>
            )}
            {tagIds.map((id) => {
              const tag = tags[id];
              if (!tag) return null;
              return <TagBadge tag={tag.name} color={tag.color} />;
            })}
          </div>
        </ScrollableText>
      </button>

      <DropdownMenu modal={false}>
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
          <DropdownMenuItem onClick={() => onPinToggle?.(gist.id)}>
            <Pin className="h-4 w-4 mr-2" />
            {isPinned ? "Unpin gist" : "Pin gist"}
          </DropdownMenuItem>
          {onEditTags && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <TagIcon className="h-4 w-4 mr-2" />
                Tag gist
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="z-100">
                {Object.entries(tags).map(([id, tag]) => (
                  <DropdownMenuItem
                    key={id}
                    onClick={() =>
                      onToggleTag?.(gist.id, id, !tagIds.includes(id))
                    }
                    className="cursor-pointer"
                  >
                    {tagIds.includes(id) && <Check className="h-4 w-4 mr-2" />}
                    {!tagIds.includes(id) && <span className="w-4 mr-2" />}
                    <TagBadge tag={tag.name} color={tag.color} />
                  </DropdownMenuItem>
                ))}
                {Object.keys(tags).length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => onEditTags()}>
                  <TagIcon className="h-4 w-4 mr-2" />
                  Manage tags
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              navigator.clipboard.writeText(
                `${window.location.origin}/#/${gist.id}`
              )
            }
          >
            <Link className="h-4 w-4 mr-2" />
            Copy URL
          </DropdownMenuItem>
          {onViewFullscreen && (
            <DropdownMenuItem onClick={() => onViewFullscreen(gist.id)}>
              <Fullscreen className="h-4 w-4 mr-2" />
              View Fullscreen
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDuplicateGist?.(gist.id)}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate gist
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onArchiveToggle?.(gist.id)}>
            <Archive className="h-4 w-4 mr-2" />
            Archive gist
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(gist)}
            className="text-red-500 focus:text-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete gist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
