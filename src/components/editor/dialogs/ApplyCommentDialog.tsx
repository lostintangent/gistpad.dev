import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ApplyCommentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (clarification: string) => void;
    comment: string;
}

export default function ApplyCommentDialog({
    isOpen,
    onOpenChange,
    onApply,
    comment,
}: ApplyCommentDialogProps) {
    const [clarification, setClarification] = useState("");
    const [isCommentOpen, setIsCommentOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Apply comment</DialogTitle>
                </DialogHeader>
                <div className="mt-2">
                    <Textarea
                        value={clarification}
                        onChange={(e) => setClarification(e.target.value)}
                        placeholder="How would you like to apply this comment?"
                        className="h-32"
                    />
                    {isCommentOpen && (
                        <div className="rounded-md border p-3 mt-2">
                            <MarkdownPreview enableBlockquoteCopying={false}>{comment}</MarkdownPreview>
                        </div>
                    )}
                </div>
                <DialogFooter className="flex justify-between items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => setIsCommentOpen(!isCommentOpen)}
                    >
                        {isCommentOpen ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                        <span>
                            {isCommentOpen
                                ? "Hide comment details"
                                : "Show comment details"}
                        </span>
                    </Button>
                    <Button
                        onClick={() => {
                            onApply(clarification);
                            onOpenChange(false);
                            setClarification("");
                        }}
                    >
                        Apply
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
