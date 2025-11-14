import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string, url: string) => void;
  initialText: string;
}

const URL_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?].*)?$/;

export function LinkDialog({
  isOpen,
  onClose,
  onInsert,
  initialText,
}: LinkDialogProps) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      setText(initialText);

      navigator.clipboard
        .readText()
        .then((clipText) => {
          if (URL_PATTERN.test(clipText)) {
            setUrl(clipText);
          } else {
            setUrl("");
          }
        })
        .catch(() => {
          setUrl("");
        });
    }
  }, [isOpen, initialText]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onInsert(text, url);
            onClose();
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="text">Link text</Label>
              <Input
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="col-span-3"
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url">Link URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Insert</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
