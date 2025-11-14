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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UnsavedChangesDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onDiscard: () => void;
    onSave: () => void;
}

const UnsavedChangesDialog = ({
    isOpen,
    onOpenChange,
    onDiscard,
    onSave,
}: UnsavedChangesDialogProps) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes in the current gist. Would you like to save them before switching?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        onClick={onDiscard}
                        className={cn(buttonVariants({ variant: "destructive" }))}
                    >
                        Discard changes
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onSave}
                        className={cn(buttonVariants({ variant: "default" }))}
                    >
                        Save changes
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default UnsavedChangesDialog;