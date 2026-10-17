import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { usePreferences, useUpdatePreferences, type TagData } from "@/features/session/queries";
import { tagFiltersAtom } from "../store";
import { Plus, Trash2 } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useState } from "react";

const DEFAULT_TAG_COLOR = "#3b82f6";

const newTag = () => [crypto.randomUUID(), { name: "", color: DEFAULT_TAG_COLOR }] as const;

/** Removes tags from the gists they're applied to. */
const untagGists = (gistTags: Record<string, string[]>, isRemoved: (tagId: string) => boolean) =>
  Object.fromEntries(
    Object.entries(gistTags)
      .map(([gistId, tagIds]) => [gistId, tagIds.filter((tagId) => !isRemoved(tagId))] as const)
      .filter(([, tagIds]) => tagIds.length > 0),
  );

function TagsForm({ onSaved }: { onSaved: () => void }) {
  const { tags } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  // If there aren't any tags yet, then start with an empty one, so the user can type its name.
  const [edits, setEdits] = useState<Record<string, TagData>>(() =>
    Object.keys(tags).length > 0 ? tags : Object.fromEntries([newTag()]),
  );
  const [tagToDelete, setTagToDelete] = useState<{ id: string; name: string }>();

  const updateTag = (id: string, changes: Partial<TagData>) =>
    setEdits((edits) => ({ ...edits, [id]: { ...edits[id], ...changes } }));

  /** Saves the tags, where tags that were deleted (or whose names were cleared) are removed from gists. */
  const saveTags = (edits: Record<string, TagData>) => {
    const updatedTags = Object.fromEntries(
      Object.entries(edits)
        .filter(([, tag]) => tag.name.trim())
        .map(([id, tag]) => [id, { name: tag.name.trim(), color: tag.color }]),
    );

    updatePreferences(({ gistTags }) => ({
      tags: updatedTags,
      gistTags: untagGists(gistTags, (tagId) => !updatedTags[tagId]),
    }));
    tagFiltersAtom.set((ids) => ids.filter((tagId) => updatedTags[tagId]));
  };

  const removeTag = (id: string) => {
    const { [id]: _, ...remainingEdits } = edits;
    setEdits(remainingEdits);

    // Deleting a saved tag (which is confirmed) takes effect immediately
    // (without saving the other tags' edits)
    if (tags[id]) saveTags({ ...tags, [id]: { ...tags[id], name: "" } });
  };

  const tagCount = Object.values(tags).filter((tag) => tag.name.trim()).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Manage tags{tagCount > 0 ? ` (${tagCount})` : ""}</DialogTitle>
      </DialogHeader>
      <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
        {Object.entries(edits).map(([id, tag]) => (
          <div key={id} className="flex items-center gap-2 p-1">
            <input
              type="color"
              value={tag.color}
              onChange={(e) => updateTag(id, { color: e.target.value })}
              className="h-7 w-7 p-0 border-0 bg-transparent"
              aria-label="Tag color"
            />
            <Input
              value={tag.name}
              onChange={(e) => updateTag(id, { name: e.target.value })}
              className="h-7 flex-1"
              // Focus new tags (whose rows are only mounted once), so the user can type their name
              autoFocus={!tags[id]}
              placeholder="Tag name..."
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => (tags[id] ? setTagToDelete({ id, name: tag.name }) : removeTag(id))}
              aria-label="Delete tag"
            >
              <Trash2 className="text-red-500" />
            </Button>
          </div>
        ))}
      </div>
      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button
          className="bg-green-700 hover:bg-green-800 text-white"
          onClick={() => setEdits({ ...edits, ...Object.fromEntries([newTag()]) })}
        >
          <Plus /> Add tag
        </Button>
        <Button
          onClick={() => {
            saveTags(edits);
            onSaved();
          }}
        >
          Save
        </Button>
      </DialogFooter>

      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{tagToDelete?.name}" tag? This will also remove
              the tag from all associated gists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (tagToDelete) removeTag(tagToDelete.id);
                setTagToDelete(undefined);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Opens the dialog for editing the user's tags (e.g. from the tag filter, or a gist's menu). */
export const editTagsDialog = DialogPrimitive.createHandle();

export default function EditTagsDialog() {
  return (
    <Dialog handle={editTagsDialog}>
      <DialogContent>
        <TagsForm onSaved={() => editTagsDialog.close()} />
      </DialogContent>
    </Dialog>
  );
}
