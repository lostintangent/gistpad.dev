import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { useState } from "react";

// oxlint-disable-next-line no-control-regex
const INVALID_CHARACTERS = /[<>:"/\\|?*\x00-\x1F]/;

function validateFilename(filename: string) {
  if (INVALID_CHARACTERS.test(filename)) return "Filename contains invalid characters";
  if (filename.length > 255) return "Filename is too long";
  return null;
}

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
  const error = validateFilename(filename);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(filename.endsWith(".md") ? filename : `${filename}.md`);
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
