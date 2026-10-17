import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useState } from "react";

const URL_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?].*)?$/;

/**
 * Reads a URL from the clipboard (if it contains one), to prefill a link with. Browsers only
 * allow this in response to a user action, so it's read when the user clicks "Insert link".
 */
export async function readClipboardUrl() {
  const text = await navigator.clipboard.readText().catch(() => "");
  return URL_PATTERN.test(text) ? text : "";
}

/** Inserts a markdown link. */
export function LinkDialog({
  initialText,
  initialUrl,
  onClose,
  onInsert,
}: {
  initialText: string;
  initialUrl: string;
  onClose: () => void;
  onInsert: (text: string, url: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
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
              <Label htmlFor="link-text">Link text</Label>
              <Input
                id="link-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="col-span-3"
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="link-url">Link URL</Label>
              <Input
                id="link-url"
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
