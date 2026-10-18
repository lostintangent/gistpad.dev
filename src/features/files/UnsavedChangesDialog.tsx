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

/** Asks the user what to do with their unsaved changes, before leaving the current file. */
export default function UnsavedChangesDialog({
  isOpen,
  isSaving,
  onCancel,
  onDiscard,
  onSave,
}: {
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  /** Omitted when the changes can't be saved (e.g. the gist belongs to someone else). */
  onSave?: () => void;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes in the current gist.
            {onSave && " Would you like to save them before switching?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard changes
          </AlertDialogAction>
          {onSave && (
            <AlertDialogAction onClick={onSave} disabled={isSaving}>
              Save changes
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
