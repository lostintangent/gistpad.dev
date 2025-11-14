import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
} from "@/components/ui/dialog";
import { Loader2, Save, Trash } from "lucide-react";
import { useState } from "react";

interface ResearchResultsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    content: string;
    topic: string;
    onSave: () => void;
    onClear: () => void;
}

const ResearchResultsDialog = ({
    isOpen,
    onOpenChange,
    content,
    topic,
    onSave,
    onClear,
}: ResearchResultsDialogProps) => {
    const [saveInProgress, setSaveInProgress] = useState(false);

    const handleSave = async () => {
        setSaveInProgress(true);
        await onSave();
        setSaveInProgress(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => onOpenChange(false)}>
            <DialogContent className="max-w-4xl h-[80vh]">
                <DialogHeader>
                    <p className="text-gray-500 italic text-left">{topic}</p>
                </DialogHeader>
                <div className="flex-1 overflow-auto py-4">
                    <MarkdownPreview isReadonly={true}>{content}</MarkdownPreview>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button
                        onClick={handleSave}
                        className="gap-2"
                        disabled={saveInProgress}
                    >
                        {saveInProgress ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Save
                            </>
                        )}
                    </Button>
                    <Button variant="destructive" onClick={onClear} className="gap-2">
                        <Trash className="h-4 w-4" />
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ResearchResultsDialog;
