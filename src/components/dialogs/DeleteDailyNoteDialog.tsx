import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface DeleteDailyNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    filename: string;  // Keeping the prop name for backwards compatibility
}

const DeleteDailyNoteDialog = ({
    open,
    onOpenChange,
    onConfirm,
    filename, // This now contains the description
}: DeleteDailyNoteDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete daily note</DialogTitle>
                </DialogHeader>
                <p>
                    Are you sure you want to delete the note &quot;{filename}&quot;?
                </p>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DeleteDailyNoteDialog;