import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

/** Asks for additional instructions for an agent command (e.g. how to apply a review comment). */
export default function InstructionsDialog({
  title,
  placeholder,
  submitLabel,
  details,
  onClose,
  onSubmit,
}: {
  title: string;
  placeholder: string;
  submitLabel: string;
  /** Markdown that provides context for the instructions (which can be expanded). */
  details?: string;
  onClose: () => void;
  onSubmit: (instructions: string) => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={placeholder}
            className="h-32"
            autoFocus
          />
          {details && showDetails && (
            <div className="rounded-md border p-3 mt-2">
              <MarkdownPreview enableBlockquoteCopying={false}>{details}</MarkdownPreview>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between items-center">
          {details && (
            <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? <ChevronUp /> : <ChevronDown />}
              {showDetails ? "Hide comment details" : "Show comment details"}
            </Button>
          )}
          <Button
            onClick={() => {
              onSubmit(instructions);
              onClose();
            }}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
