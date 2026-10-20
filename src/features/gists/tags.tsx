import { Badge } from "@/shared/ui/badge";
import { DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/shared/ui/dropdown-menu";
import { usePreferences, useTagCounts, type TagData } from "@/features/account/queries";
import { CommandDropdownItem } from "@/features/commands/CommandDropdownItem";
import { executeCommand } from "@/features/commands/registry";
import { manageTagsCommand, tagCommands } from "./tagCommands";

function isLightColor(hex: string) {
  const rgb = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [16, 8, 0].map((shift) => (rgb >> shift) & 0xff);

  // Weighted perceived brightness (YIQ)
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
}

/** A tag (e.g. on a gist), and optionally, a count (e.g. of the gists that have it). */
export function TagBadge({ tag, count }: { tag: TagData; count?: number }) {
  return (
    <Badge
      style={{ backgroundColor: tag.color }}
      className={`relative text-xs ${isLightColor(tag.color) ? "text-black" : "text-white"}`}
    >
      <span className="block flex-1 truncate min-w-0">{tag.name}</span>
      {typeof count === "number" && (
        <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white text-black w-3.5 h-3.5 text-[9px]">
          {count}
        </span>
      )}
    </Badge>
  );
}

/**
 * A dropdown menu's checklist of the user's tags (and how many gists have each one). And when they
 * can be managed from it, it ends with an item that opens the dialog for managing them.
 */
export function TagMenuItems({
  tagIds,
  onChange,
  canManage = false,
}: {
  tagIds: string[];
  onChange: (tagIds: string[]) => void;
  canManage?: boolean;
}) {
  const { tags } = usePreferences();
  const tagCounts = useTagCounts();

  return (
    <>
      {tagCommands(tags, tagIds, onChange).map((command) => {
        const id = command.tagId;
        return (
          <DropdownMenuCheckboxItem
            key={id}
            checked={command.checked}
            onCheckedChange={() => void executeCommand(command)}
          >
            <TagBadge tag={tags[id]} count={tagCounts[id]} />
          </DropdownMenuCheckboxItem>
        );
      })}
      {canManage && (
        <>
          {Object.keys(tags).length > 0 && <DropdownMenuSeparator />}
          <CommandDropdownItem command={manageTagsCommand} />
        </>
      )}
    </>
  );
}
