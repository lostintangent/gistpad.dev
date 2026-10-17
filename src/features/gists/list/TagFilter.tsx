import { Checkbox } from "@/shared/ui/checkbox";
import { InputGroupButton } from "@/shared/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Separator } from "@/shared/ui/separator";
import { usePreferences } from "@/features/session/queries";
import { tagFiltersAtom } from "../store";
import { useAtom } from "@tanstack/react-store";
import { Tag } from "lucide-react";
import TagBadge from "../TagBadge";
import { editTagsDialog } from "../dialogs/EditTagsDialog";

/** Filters the gist list by the tags the user has assigned to their gists (from within its filter input). */
export function TagFilter() {
  const { tags, gistTags } = usePreferences();
  const [selectedTagIds, setSelectedTagIds] = useAtom(tagFiltersAtom);

  const tagCounts: Record<string, number> = {};
  for (const tagId of Object.values(gistTags).flat()) {
    tagCounts[tagId] = (tagCounts[tagId] ?? 0) + 1;
  }

  const toggle = (tagId: string, isSelected: boolean) =>
    setSelectedTagIds((ids) => (isSelected ? [...ids, tagId] : ids.filter((id) => id !== tagId)));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <InputGroupButton
            aria-label="Filter by tag"
            className={selectedTagIds.length > 0 ? "bg-muted text-foreground" : ""}
          />
        }
      >
        <Tag />
        {selectedTagIds.length > 0 && selectedTagIds.length}
      </PopoverTrigger>
      <PopoverContent className="w-39 space-y-1 p-2.5" align="end">
        {Object.entries(tags).map(([id, tag]) => (
          <label key={id} className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={selectedTagIds.includes(id)}
              onCheckedChange={(checked) => toggle(id, checked)}
            />
            <TagBadge tag={tag.name} color={tag.color} count={tagCounts[id]} />
          </label>
        ))}
        {Object.keys(tags).length > 0 && <Separator className="mt-3!" />}
        <button
          className="text-sm w-full text-left hover:bg-muted p-1 rounded flex items-center gap-2"
          onClick={() => editTagsDialog.open(null)}
        >
          <Tag className="h-4 w-4" /> Manage tags
        </button>
      </PopoverContent>
    </Popover>
  );
}
