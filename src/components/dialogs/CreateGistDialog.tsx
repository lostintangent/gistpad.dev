import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TagData } from "@/hooks/useUserSession";
import { Check, Plus, Tag as TagIcon } from "lucide-react";
import { useRef, useState } from "react";
import { EmojiInput } from "../editor/EmojiInput";
import TagBadge from "../list/TagBadge";

interface CreateGistDialogProps {
  onSubmit: (
    description: string,
    content?: string,
    isPublic?: boolean,
    selectedTags?: string[]
  ) => void;
  initialContent?: string;
  tags?: Record<string, TagData>;
}

const CreateGistDialog = ({
  onSubmit,
  initialContent,
  tags = {},
}: CreateGistDialogProps) => {
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const longPressTimeout = useRef<NodeJS.Timeout>();
  const longPressTriggered = useRef(false);
  const [isPublic, setIsPublic] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setDescription("");
      setSelectedTags([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(description.trim(), initialContent, isPublic, selectedTags);
    setDescription("");
    setSelectedTags([]);
    setOpen(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prevSelectedTags) => {
      if (prevSelectedTags.includes(tagId)) {
        return prevSelectedTags.filter((id) => id !== tagId);
      } else {
        return [...prevSelectedTags, tagId];
      }
    });
  };

  const handlePointerDown = () => {
    longPressTriggered.current = false;
    longPressTimeout.current = setTimeout(() => {
      longPressTriggered.current = true;
      onSubmit("", undefined, false);
    }, 300);
  };

  const handlePointerUp = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = undefined;
    }

    if (!longPressTriggered.current) {
      setOpen(true);
    }
  };

  const handlePointerLeave = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = undefined;
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="mr-2 select-none bg-green-700!"
        title="Create new gist"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden md:inline">New</span>
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-visible">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create new gist</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <EmojiInput
                placeholder="Enter gist title..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <div className="flex items-center gap-4 w-full justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="public-toggle" className="text-sm">
                    Public
                  </Label>
                  <Switch
                    id="public-toggle"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                  {Object.entries(tags).length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`ml-2 relative${selectedTags.length > 0 ? " bg-muted" : ""}`}
                        >
                          <TagIcon className="h-4 w-4" />
                          {selectedTags.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                              {selectedTags.length}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-45">
                        {Object.entries(tags).map(([id, tag]) => (
                          <DropdownMenuItem
                            key={id}
                            onClick={(e) => {
                              e.preventDefault();
                              toggleTag(id);
                            }}
                          >
                            {selectedTags.includes(id) && (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            {!selectedTags.includes(id) && (
                              <span className="w-4 mr-2" />
                            )}
                            <TagBadge tag={tag.name} color={tag.color} />
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <Button type="submit">Create</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateGistDialog;
