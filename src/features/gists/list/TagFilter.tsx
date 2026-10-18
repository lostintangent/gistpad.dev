import { Checkbox } from "@/shared/ui/checkbox";
import { InputGroupButton } from "@/shared/ui/input-group";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Separator } from "@/shared/ui/separator";
import { usePreferences } from "@/features/account/queries";
import { tagFiltersAtom } from "../store";
import { useAtom } from "@tanstack/react-store";
import { Tag } from "lucide-react";
import TagBadge from "../TagBadge";
import { editTagsDialog } from "../dialogs/EditTagsDialog";

/** Filters the gist list by the tags the user has assigned to their gists (from within its filter input). */
export function TagFilter() {
  const { tags, gistTags } = usePreferences();
  const [selectedTagIds, setSelectedTagIds] = useAtom(tagFiltersAtom);

  const tagUses = Object.groupBy(Object.values(gistTags).flat(), (tagId) => tagId);

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
      <PopoverContent className="w-39 space-y-1 p-2.5" align="start">
        {Object.entries(tags).map(([id, tag]) => (
          <label key={id} className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={selectedTagIds.includes(id)}
              onCheckedChange={(checked) =>
                setSelectedTagIds((ids) => (checked ? [...ids, id] : ids.filter((t) => t !== id)))
              }
            />
            <TagBadge tag={tag.name} color={tag.color} count={tagUses[id]?.length} />
          </label>
        ))}
        {Object.keys(tags).length > 0 && <Separator className="mt-3!" />}
        {/* (Which closes the filter, so that it isn't left open behind the dialog) */}
        <PopoverClose
          className="text-sm w-full text-left hover:bg-muted p-1 rounded flex items-center gap-2"
          onClick={() => editTagsDialog.open(null)}
        >
          <Tag className="h-4 w-4" /> Manage tags
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
