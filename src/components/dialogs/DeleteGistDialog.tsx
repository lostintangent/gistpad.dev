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

interface DeleteGistDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  gistDescription: string;
  isDeletingFile?: boolean;
}

const DeleteGistDialog = ({
  isOpen,
  onOpenChange,
  onConfirm,
  gistDescription,
  isDeletingFile = false,
}: DeleteGistDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isDeletingFile ? "Delete file" : "Delete gist"}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {isDeletingFile ? "the file" : "the gist"} &quot;
            {gistDescription || "Untitled"}&quot;?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm()}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteGistDialog;
