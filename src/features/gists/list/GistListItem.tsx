import { ScrollableText } from "@/shared/ScrollableText";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { useOpenDocument } from "@/features/editor/document";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { useDuplicateGist, useToggleArchived } from "../queries";
import { usePreferences, useUpdatePreferences } from "@/features/account/queries";
import { useIsAiInProgress } from "@/features/ai/store";
import { draftAtom } from "@/features/editor/store";
import { useSelector } from "@tanstack/react-store";
import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Copy,
  Fullscreen,
  Link,
  MoreHorizontal,
  Pin,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { GistRow } from "./GistLink";
import { GistMetadata } from "./GistMetadata";
import TagBadge from "../TagBadge";
import { deleteGistDialog } from "../dialogs/DeleteGistDialog";
import { editTagsDialog } from "../dialogs/EditTagsDialog";

/** The gist's name, where placeholder names (e.g. "Untitled") are de-emphasized. */
function GistTitle({ gist, isProcessing }: { gist: Gist; isProcessing: boolean }) {
  const name = getGistDisplayName(gist);
  const isPlaceholder = !gist.description && (name === "Untitled" || name === "Empty");
  if (!isPlaceholder) return <>{name}</>;

  return <span className={`italic${isProcessing ? "" : " text-muted-foreground"}`}>{name}</span>;
}

export function GistListItem({
  gist,
  isPinned,
  isSelected,
}: {
  gist: Gist;
  isPinned: boolean;
  isSelected: boolean;
}) {
  const { tags, gistTags, researchTasks } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const isAiInProgress = useIsAiInProgress();
  const hasUnsavedChanges = useSelector(
    draftAtom,
    (draft) => !!draft?.documentKey.startsWith(`${gist.id}/`),
  );

  const navigate = useNavigate();
  const openDocument = useOpenDocument();
  const { mutateAsync: duplicateGist } = useDuplicateGist();
  const { mutate: toggleArchived } = useToggleArchived();

  const tagIds = gistTags[gist.id] ?? [];
  const gistResearchTasks = researchTasks.filter((task) => task.gistId === gist.id);
  const isProcessing =
    gistResearchTasks.some((task) => !task.content) || (isAiInProgress && isSelected);
  const hasUnseenResults = gistResearchTasks.some((task) => task.content && !task.hasBeenSeen);

  const togglePinned = () =>
    updatePreferences(({ pinnedGists }) => ({
      pinnedGists: isPinned
        ? pinnedGists.filter((id) => id !== gist.id)
        : [...pinnedGists, gist.id],
    }));

  const toggleTag = (tagId: string) =>
    updatePreferences(({ gistTags }) => {
      const current = gistTags[gist.id] ?? [];
      const updated = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];

      return { gistTags: { ...gistTags, [gist.id]: updated } };
    });

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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <TagIcon />
            Tag gist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-100">
            {Object.entries(tags).map(([id, tag]) => (
              <DropdownMenuCheckboxItem
                key={id}
                checked={tagIds.includes(id)}
                onCheckedChange={() => toggleTag(id)}
                closeOnClick
              >
                <TagBadge tag={tag.name} color={tag.color} />
              </DropdownMenuCheckboxItem>
            ))}
            {Object.keys(tags).length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => editTagsDialog.open(null)}>
              <TagIcon />
              Manage tags
            </DropdownMenuItem>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={async () => openDocument((await duplicateGist(gist.id)).id)}>
          <Copy />
          Duplicate gist
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleArchived(gist)}>
          <Archive />
          Archive gist
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
  );

  return (
    <GistRow gistId={gist.id} isSelected={isSelected} action={menu}>
      <h3 className="font-medium flex items-center gap-1">
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
          <span className={isProcessing ? "ai-gradient-text" : ""}>
            <GistTitle gist={gist} isProcessing={isProcessing} />
          </span>
        </ScrollableText>
      </h3>

      <ScrollableText>
        <GistMetadata
          gist={gist}
          hasIndicator={hasUnseenResults || (hasUnsavedChanges && isSelected)}
        >
          {tagIds.map(
            (id) => tags[id] && <TagBadge key={id} tag={tags[id].name} color={tags[id].color} />,
          )}
        </GistMetadata>
      </ScrollableText>
    </GistRow>
  );
}
