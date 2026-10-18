import { ScrollableText } from "@/shared/ScrollableText";
import { UserAvatar } from "@/shared/UserAvatar";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { openDocument } from "@/features/editor/document";
import { getGistDisplayName, isArchived, type Gist } from "@/shared/github";
import { useDuplicateGist, useIsStarred, useToggleArchived, useToggleStarred } from "../queries";
import { usePreferences, useSession, useUpdatePreferences } from "@/features/account/queries";
import { useIsAiInProgress } from "@/features/ai/store";
import { draftAtom } from "@/features/editor/store";
import { useSelector } from "@tanstack/react-store";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Fullscreen,
  Link,
  MoreHorizontal,
  Pin,
  Star,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { ListItem } from "./ListItem";
import { GistMetadata } from "./GistMetadata";
import { TagBadge, TagMenuItems } from "../tags";
import { deleteGistDialog } from "../dialogs/DeleteGistDialog";

/**
 * A gist in the gist list, whose menu offers what can be done with it (e.g. only the user's own
 * gists can be archived). Compact items (e.g. in the starred section) omit the gist's details.
 */
export function GistItem({
  gist,
  isOpen,
  compact = false,
}: {
  gist: Gist;
  isOpen: boolean;
  compact?: boolean;
}) {
  const { user } = useSession();
  const { tags, gistTags, pinnedGists, researchTasks } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const isAiInProgress = useIsAiInProgress();
  const hasUnsavedChanges = useSelector(
    draftAtom,
    (draft) => !!draft?.documentKey.startsWith(`${gist.id}/`),
  );

  const navigate = useNavigate();
  const { mutateAsync: duplicateGist } = useDuplicateGist();
  const { mutate: toggleArchived } = useToggleArchived();
  const { mutate: toggleStarred } = useToggleStarred();

  const isOwn = gist.owner?.login === user?.login;
  const isPinned = pinnedGists.includes(gist.id);
  const isStarred = useIsStarred(gist.id);

  const name = getGistDisplayName(gist);
  // Placeholder names (e.g. "Untitled") are de-emphasized
  const isPlaceholder = !gist.description && (name === "Untitled" || name === "Empty");
  const tagIds = gistTags[gist.id] ?? [];
  const gistResearchTasks = researchTasks.filter((task) => task.gistId === gist.id);
  const isProcessing =
    gistResearchTasks.some((task) => !task.content) || (isAiInProgress && isOpen);
  const hasUnseenResults = gistResearchTasks.some((task) => task.content && !task.hasBeenSeen);

  const togglePinned = () =>
    updatePreferences(({ pinnedGists }) => ({
      pinnedGists: isPinned
        ? pinnedGists.filter((id) => id !== gist.id)
        : [...pinnedGists, gist.id],
    }));

  const setTagIds = (tagIds: string[]) =>
    updatePreferences(({ gistTags }) => ({ gistTags: { ...gistTags, [gist.id]: tagIds } }));

  const menu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" aria-label="Gist options" />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={togglePinned}>
          <Pin />
          {isPinned ? "Unpin gist" : "Pin gist"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleStarred(gist)}>
          <Star />
          {isStarred ? "Unstar gist" : "Star gist"}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <TagIcon />
            Tag gist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-100">
            <TagMenuItems tagIds={tagIds} onChange={setTagIds} canManage />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText(`${location.origin}/#/${gist.id}`)}
        >
          <Link />
          Copy URL
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            navigate({ to: "/share/$gistId/{-$filePath}", params: { gistId: gist.id } })
          }
        >
          <Fullscreen />
          View Fullscreen
        </DropdownMenuItem>
        {isOwn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => openDocument((await duplicateGist(gist.id)).id)}>
              <Copy />
              Duplicate gist
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleArchived(gist)}>
              {isArchived(gist) ? <ArchiveRestore /> : <Archive />}
              {isArchived(gist) ? "Unarchive gist" : "Archive gist"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => deleteGistDialog.openWithPayload({ gist })}
            >
              <Trash2 />
              Delete gist
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <ListItem gistId={gist.id} isOpen={isOpen} compact={compact} action={menu}>
      <h3 className={cn("flex items-center", compact ? "gap-2 text-sm" : "gap-1 font-medium")}>
        {/* (Other people's gists, e.g. starred ones, show who owns them) */}
        {!isOwn && <UserAvatar user={gist.owner} className="size-5" />}
        {isPinned && (
          <Tooltip>
            <TooltipTrigger>
              <Pin className="h-3.5 w-3.5 shrink-0 text-accent" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Pinned gist</p>
            </TooltipContent>
          </Tooltip>
        )}
        <ScrollableText>
          <span
            className={cn(
              isPlaceholder && "italic",
              isProcessing ? "ai-gradient-text" : isPlaceholder && "text-muted-foreground",
            )}
          >
            {name}
          </span>
        </ScrollableText>
      </h3>

      {!compact && (
        <ScrollableText>
          <GistMetadata gist={gist} hasIndicator={hasUnseenResults || hasUnsavedChanges}>
            {tagIds.map((id) => tags[id] && <TagBadge key={id} tag={tags[id]} />)}
          </GistMetadata>
        </ScrollableText>
      )}
    </ListItem>
  );
}
