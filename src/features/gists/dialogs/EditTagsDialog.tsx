import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { usePreferences, useUpdatePreferences, type TagData } from "@/features/account/queries";
import { tagFiltersAtom } from "../store";
import TagBadge, { isLightColor } from "../TagBadge";
import { Plus, Trash2 } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";

/** The colors that tags can be (or any other), which are legible (with black or white text) in light and dark mode. */
const TAG_COLORS = [
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#facc15",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

/** A new tag's color, which is the first one that isn't used yet (or else, the next one in turn). */
function getNextColor(tags: Record<string, TagData>) {
  const usedColors = new Set(Object.values(tags).map(({ color }) => color));
  return (
    TAG_COLORS.find((color) => !usedColors.has(color)) ??
    TAG_COLORS[Object.keys(tags).length % TAG_COLORS.length]
  );
}

/** Opens the dialog for editing the user's tags (e.g. from the tag filter, or a gist's menu). */
export const editTagsDialog = DialogPrimitive.createHandle();

/** A tag's name, while it's being typed (e.g. to rename the tag), which looks like the tag's pill. */
function TagNameInput({ color, ...props }: ComponentProps<"input"> & { color: string }) {
  return (
    <Badge
      render={<input autoFocus placeholder="Tag name" {...props} />}
      style={{ backgroundColor: color }}
      className={cn(
        "min-w-0 flex-1 justify-start outline-none",
        isLightColor(color) ? "text-black" : "text-white",
      )}
    />
  );
}

/** Picks a tag's color, from the palette (or a custom one, from the system's color picker). */
function TagColorPicker({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const isCustom = !TAG_COLORS.includes(color);

  const pick = (color: string) => {
    onChange(color);
    setIsOpen(false);
  };

  const swatchClass = (isSelected: boolean) =>
    cn(
      "size-6 rounded-full",
      isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
    );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        aria-label="Change color"
        style={{ backgroundColor: color }}
        className="size-4 shrink-0 rounded-full hover:ring-2 hover:ring-ring/50 hover:ring-offset-2 hover:ring-offset-background"
      />
      <PopoverContent align="start" className="grid w-auto grid-cols-6 gap-2 p-3">
        {TAG_COLORS.map((swatch) => (
          <button
            key={swatch}
            aria-label={swatch}
            style={{ backgroundColor: swatch }}
            className={swatchClass(swatch === color)}
            onClick={() => pick(swatch)}
          />
        ))}
        <label
          title="Custom color"
          className={cn(
            swatchClass(isCustom),
            "relative bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]",
          )}
        >
          {/* (Covered by the color input, so that clicking it opens the system's color picker, and
              the color is only saved once it's chosen, rather than as it's dragged) */}
          <input
            type="color"
            defaultValue={color}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            ref={(input) => {
              const save = () => input && pick(input.value);
              input?.addEventListener("change", save);
              return () => input?.removeEventListener("change", save);
            }}
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}

/** A tag, whose name is edited by clicking its pill, and whose color is edited by clicking its dot. */
function TagRow({
  tag,
  useCount,
  onChange,
  onDelete,
}: {
  tag: TagData;
  useCount: number;
  onChange: (changes: Partial<TagData>) => void;
  onDelete: () => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);

  return (
    <li className="flex items-center gap-3 px-2 py-1.5">
      <TagColorPicker color={tag.color} onChange={(color) => onChange({ color })} />
      {isRenaming ? (
        <TagNameInput
          color={tag.color}
          defaultValue={tag.name}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            // (Escape reverts the name, rather than closing the dialog)
            if (e.key === "Escape") {
              e.stopPropagation();
              e.currentTarget.value = tag.name;
            }
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
          onBlur={(e) => {
            const name = e.currentTarget.value.trim();
            if (name && name !== tag.name) onChange({ name });
            setIsRenaming(false);
          }}
        />
      ) : (
        <button
          title="Rename tag"
          className="min-w-0 flex-1 text-left"
          onClick={() => setIsRenaming(true)}
        >
          <TagBadge tag={tag.name} color={tag.color} />
        </button>
      )}
      <Badge variant="count" title={`Used by ${useCount} ${useCount === 1 ? "gist" : "gists"}`}>
        {useCount}
      </Badge>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${tag.name}`}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

/** Adds tags, by typing their names, one after another (since pressing Enter starts the next one). */
function NewTagRow({
  color,
  isInitiallyAdding,
  onAdd,
}: {
  color: string;
  isInitiallyAdding: boolean;
  onAdd: (name: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(isInitiallyAdding);

  if (!isAdding) {
    return (
      <li className="px-2 py-1.5">
        <button
          className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="size-4" />
          New tag
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-2 py-1.5">
      <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <TagNameInput
        color={color}
        onKeyDown={(e) => {
          const input = e.currentTarget;
          if (e.key === "Enter" && input.value.trim()) {
            onAdd(input.value.trim());
            input.value = "";
          } else if (e.key === "Escape") {
            e.stopPropagation();
            input.value = "";
            input.blur();
          }
        }}
        onBlur={(e) => {
          const name = e.currentTarget.value.trim();
          if (name) onAdd(name);
          setIsAdding(false);
        }}
      />
    </li>
  );
}

/** The user's tags, whose changes are saved as they're made (and whose deletion can be undone). */
function TagList() {
  const { tags, gistTags } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const tagUses = Object.groupBy(Object.values(gistTags).flat(), (tagId) => tagId);

  const addTag = (name: string) =>
    updatePreferences(({ tags }) => ({
      tags: { ...tags, [crypto.randomUUID()]: { name, color: getNextColor(tags) } },
    }));

  const updateTag = (id: string, changes: Partial<TagData>) =>
    updatePreferences(({ tags }) => ({ tags: { ...tags, [id]: { ...tags[id], ...changes } } }));

  /** Deletes a tag (and removes it from its gists), which can be undone, from a toast. */
  const deleteTag = (id: string) => {
    const tag = tags[id];
    const index = Object.keys(tags).indexOf(id);
    const taggedGists = Object.fromEntries(
      Object.entries(gistTags).filter(([, tagIds]) => tagIds.includes(id)),
    );
    const wasFiltered = tagFiltersAtom.get().includes(id);

    updatePreferences(({ tags: { [id]: _, ...remainingTags }, gistTags }) => ({
      tags: remainingTags,
      gistTags: Object.fromEntries(
        Object.entries(gistTags)
          .map(([gistId, tagIds]) => [gistId, tagIds.filter((tagId) => tagId !== id)] as const)
          .filter(([, tagIds]) => tagIds.length > 0),
      ),
    }));
    tagFiltersAtom.set((tagIds) => tagIds.filter((tagId) => tagId !== id));

    toast(`Deleted the "${tag.name}" tag`, {
      action: {
        label: "Undo",
        onClick: () => {
          updatePreferences(({ tags, gistTags }) => ({
            tags: Object.fromEntries(Object.entries(tags).toSpliced(index, 0, [id, tag])),
            gistTags: { ...gistTags, ...taggedGists },
          }));
          if (wasFiltered) tagFiltersAtom.set((tagIds) => [...tagIds, id]);
        },
      },
    });
  };

  const tagCount = Object.keys(tags).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center justify-center gap-2 sm:justify-start">
          Tags
          {tagCount > 0 && <Badge variant="count">{tagCount}</Badge>}
        </DialogTitle>
      </DialogHeader>
      <ul className="-mx-2 min-h-0 overflow-y-auto">
        {Object.entries(tags).map(([id, tag]) => (
          <TagRow
            key={id}
            tag={tag}
            useCount={tagUses[id]?.length ?? 0}
            onChange={(changes) => updateTag(id, changes)}
            onDelete={() => deleteTag(id)}
          />
        ))}
        {/* (If there aren't any tags yet, the user can start typing the first one's name) */}
        <NewTagRow color={getNextColor(tags)} isInitiallyAdding={tagCount === 0} onAdd={addTag} />
      </ul>
    </>
  );
}

export default function EditTagsDialog() {
  return (
    <Dialog handle={editTagsDialog}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-sm">
        <TagList />
      </DialogContent>
    </Dialog>
  );
}
