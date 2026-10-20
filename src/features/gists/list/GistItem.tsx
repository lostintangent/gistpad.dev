import { ScrollableText } from "@/shared/ScrollableText";
import { UserAvatar } from "@/shared/UserAvatar";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { useGistCommands } from "../commands";
import { CommandDropdownItem } from "@/features/commands/CommandDropdownItem";
import { usePreferences, useSession, useUpdatePreferences } from "@/features/account/queries";
import { useIsAgentRunning } from "@/features/agent/model/store";
import { draftAtom } from "@/features/files/draft";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import { MoreHorizontal, Pin, Tag as TagIcon } from "lucide-react";
import { ListItem } from "./ListItem";
import { GistMetadata } from "./GistMetadata";
import { TagBadge, TagMenuItems } from "../tags";

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
  const isAgentRunning = useIsAgentRunning();
  const hasUnsavedChanges = useSelector(
    draftAtom,
    (draft) => !!draft?.fileKey.startsWith(`${gist.id}/`),
  );

  const commands = useGistCommands(gist);

  const isOwn = gist.owner?.login === user?.login;
  const isPinned = pinnedGists.includes(gist.id);

  const name = getGistDisplayName(gist);
  // Placeholder names (e.g. "Untitled") are de-emphasized
  const isPlaceholder = !gist.description && (name === "Untitled" || name === "Empty");
  const tagIds = gistTags[gist.id] ?? [];
  const gistResearchTasks = researchTasks.filter((task) => task.gistId === gist.id);
  const isProcessing =
    gistResearchTasks.some((task) => !task.completedTime) || (isAgentRunning && isOpen);
  const hasUnseenResults = gistResearchTasks.some(
    (task) => task.completedTime && !task.hasBeenSeen,
  );

  const setTagIds = (tagIds: string[]) =>
    updatePreferences(({ gistTags }) => ({ gistTags: { ...gistTags, [gist.id]: tagIds } }));

  const menu = commands && (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" aria-label="Gist options" />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CommandDropdownItem command={commands.pin} />
        <CommandDropdownItem command={commands.star} />
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
        <CommandDropdownItem command={commands.copyUrl} />
        <CommandDropdownItem command={commands.fullscreen} />
        {isOwn && (
          <>
            <DropdownMenuSeparator />
            <CommandDropdownItem command={commands.duplicate} />
            <CommandDropdownItem command={commands.archive} />
            <DropdownMenuSeparator />
            <CommandDropdownItem command={commands.delete} variant="destructive" />
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
              isProcessing ? "agent-gradient-text" : isPlaceholder && "text-muted-foreground",
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
