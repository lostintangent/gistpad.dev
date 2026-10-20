import type { TagData } from "@/features/account/queries";
import type { Command } from "@/features/commands/command";
import { Tag } from "lucide-react";
import { editTagsDialog } from "./dialogs/EditTagsDialog";

export function tagCommands(
  tags: Record<string, TagData>,
  selected: string[],
  onChange: (ids: string[]) => void,
): (Command & { tagId: string })[] {
  return Object.entries(tags).map(([id, tag]) => ({
    id: `tag:${id}`,
    tagId: id,
    title: tag.name,
    checked: selected.includes(id),
    run: () =>
      onChange(
        selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id],
      ),
  }));
}

export const manageTagsCommand: Command = {
  id: "tags.manage",
  title: "Manage tags",
  icon: Tag,
  run: () => editTagsDialog.open(null),
};
