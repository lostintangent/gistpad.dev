import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { useSaveFile, type ActiveFile } from "@/features/files/file";

/** Offers to fork the open gist (which belongs to someone else), in order to save the user's changes. */
export default function ForkGistDialog({
  file,
  isOpen,
  onOpenChange,
}: {
  file: ActiveFile;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const save = useSaveFile(file);

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fork this gist?</AlertDialogTitle>
          <AlertDialogDescription>
            This gist is read-only. Would you like to create a fork and save your changes there?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              save();
            }}
          >
            Fork and save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
