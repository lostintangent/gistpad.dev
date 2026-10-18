import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { toMarkdownFilename } from "@/shared/github";
import { useState } from "react";

// oxlint-disable-next-line no-control-regex
const INVALID_CHARACTERS = /[<>:"/\\|?*\x00-\x1F]/;

/** Adds a new (markdown) file to a gist. */
export default function AddFileDialog({
  defaultFilename,
  onClose,
  onSubmit,
}: {
  defaultFilename: string;
  onClose: () => void;
  onSubmit: (filename: string) => void;
}) {
  const [filename, setFilename] = useState(defaultFilename);
  const error = INVALID_CHARACTERS.test(filename)
    ? "Filename contains invalid characters"
    : filename.length > 255
      ? "Filename is too long"
      : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(toMarkdownFilename(filename));
            onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add new file</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter file name..."
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? "filename-error" : undefined}
            />
            {error && (
              <p className="text-sm text-red-500 mt-2" id="filename-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!filename.trim() || !!error}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
