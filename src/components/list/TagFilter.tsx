import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";

import { Tag } from "lucide-react";
import { useState } from "react";
import TagBadge from "./TagBadge";

interface TagFilterProps {
  tags: Record<string, { name: string; color: string }>;
  selected: string[];
  tagCounts?: Record<string, number>;
  onChange: (ids: string[]) => void;
  onEditTags: () => void;
  onDeleteTag: (id: string) => void;
}

export const TagFilter = ({
  tags,
  selected,
  tagCounts = {},
  onChange,
  onEditTags,
  onDeleteTag,
}: TagFilterProps) => {
  const [open, setOpen] = useState(false);

  const toggle = (id: string, checked: boolean) => {
    let newIds = selected.slice();
    if (checked) {
      if (!newIds.includes(id)) newIds.push(id);
    } else {
      newIds = newIds.filter((t) => t !== id);
    }
    onChange(newIds);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Toggle
          pressed={selected.length > 0}
          size="sm"
          className="h-8 w-8 p-0 relative"
        >
          <Tag className="h-4 w-4" />
          {selected.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {selected.length}
            </span>
          )}
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-39 space-y-1 p-2.5 z-100">
        {Object.entries(tags).map(([id, tag]) => (
          <label
            key={id}
            className="flex items-center gap-2 py-1 cursor-pointer"
          >
            <Checkbox
              id={`filter-${id}`}
              checked={selected.includes(id)}
              onCheckedChange={(c) => toggle(id, !!c)}
            />
            <TagBadge tag={tag.name} color={tag.color} count={tagCounts[id]} />
          </label>
        ))}
        {Object.keys(tags).length > 0 && <Separator className="mt-3!" />}
        <button
          className="text-sm w-full text-left hover:bg-muted p-1 rounded flex items-center gap-2"
          onClick={onEditTags}
        >
          <Tag className="h-4 w-4" /> Manage tags
        </button>
      </PopoverContent>
    </Popover>
  );
};
