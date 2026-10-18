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
import { useSaveDocument, type GistDocument } from "../document";

/** Offers to fork the open gist (which belongs to someone else), in order to save the user's changes. */
export default function ForkGistDialog({
  doc,
  isOpen,
  onOpenChange,
}: {
  doc: GistDocument;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const save = useSaveDocument(doc);

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
