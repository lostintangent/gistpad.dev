import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TagData } from "@/hooks/useUserSession";

interface EditTagsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Record<string, { name: string; color: string }>;
  addTags: (tags: TagData[]) => void;
  renameTag: (id: string, name: string, color: string) => void;
  deleteTag: (id: string) => void;
}

const EditTagsDialog = ({
  isOpen,
  onOpenChange,
  tags,
  addTags,
  renameTag,
  deleteTag,
}: EditTagsDialogProps) => {
  const [edits, setEdits] =
    useState<Record<string, { name: string; color: string }>>(tags);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    tagId: string;
    tagName: string;
  }>({
    isOpen: false,
    tagId: "",
    tagName: "",
  });
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const [lastNewTagId, setLastNewTagId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      // Initialize with tags from props
      setEdits(tags);
      setLastNewTagId("");

      // If there are no tags, add an empty one
      if (Object.keys(tags).length === 0) {
        handleAddEmptyTag();
      }
    }
  }, [isOpen, tags]);

  // Focus the input when a new empty tag is added
  useEffect(() => {
    if (lastNewTagId && newTagInputRef.current) {
      setTimeout(() => {
        newTagInputRef.current?.focus();
      }, 200);
    }
  }, [lastNewTagId]);

  const handleAddEmptyTag = () => {
    const id = `new-${crypto.randomUUID()}`;
    setEdits((prev) => ({
      ...prev,
      [id]: { name: "", color: "#3b82f6" },
    }));
    setLastNewTagId(id);
  };

  const handleDeleteTag = (id: string) => {
    if (tags[id]) {
      deleteTag(id);
    }
    setEdits((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const confirmDelete = (id: string, tagName: string) => {
    if (tags[id]) {
      setDeleteConfirmation({
        isOpen: true,
        tagId: id,
        tagName: tagName,
      });
    } else {
      handleDeleteTag(id);
    }
  };

  const handleSave = () => {
    const newTags: TagData[] = [];
    Object.entries(edits).forEach(([id, data]) => {
      const trimmed = data.name.trim();
      const existing = Boolean(tags[id]);

      if (existing) {
        const orig = tags[id];
        if (!orig || orig.name !== data.name || orig.color !== data.color) {
          renameTag(id, data.name, data.color);
        }
      } else if (trimmed) {
        newTags.push({ name: trimmed, color: data.color });
      }
    });

    if (newTags.length) {
      addTags(newTags);
    }

    onOpenChange(false);
  };

  // Calculate count of non-empty tags
  const nonEmptyTagsCount = Object.values(tags).filter((tag) =>
    tag.name.trim()
  ).length;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Manage tags
              {nonEmptyTagsCount > 0 ? ` (${nonEmptyTagsCount})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            {Object.entries(edits).map(([id, tag]) => (
              <div key={id} className="flex items-center gap-2 p-1">
                <input
                  type="color"
                  value={tag.color}
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      [id]: { ...tag, color: e.target.value },
                    })
                  }
                  className="h-7 w-7 p-0 border-0 bg-transparent"
                />
                <Input
                  value={tag.name}
                  onChange={(e) =>
                    setEdits({
                      ...edits,
                      [id]: { ...tag, name: e.target.value },
                    })
                  }
                  className="h-7 flex-1"
                  ref={id === lastNewTagId ? newTagInputRef : null}
                  placeholder="Tag name..."
                />
                <Trash2
                  className="h-4 w-4 text-red-500 cursor-pointer mr-1"
                  onClick={() => confirmDelete(id, tag.name)}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="flex-row justify-between">
            <Button
              className="bg-green-700 hover:bg-green-800 text-white"
              onClick={handleAddEmptyTag}
            >
              <Plus className="h-4 w-4" /> Add tag
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) =>
          setDeleteConfirmation((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deleteConfirmation.tagName}"
              tag? This will also remove the tag from all associated gists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteTag(deleteConfirmation.tagId);
                setDeleteConfirmation({
                  isOpen: false,
                  tagId: "",
                  tagName: "",
                });
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditTagsDialog;
