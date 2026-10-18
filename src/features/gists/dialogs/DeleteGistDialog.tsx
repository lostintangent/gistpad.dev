import { getFileDisplayName, getGistDisplayName, type Gist } from "@/shared/github";
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
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { deletesGist, useDeleteGistOrFile } from "../actions";

/**
 * Opens the confirmation for deleting a gist (or one of its files), which can be requested from
 * anywhere (e.g. the gist list, the editor toolbar, or a voice command).
 */
export const deleteGistDialog = AlertDialogPrimitive.createHandle<{
  gist: Gist;
  filename?: string;
}>();

/** Confirms the deletion of a gist, or one of its files (rendered once, by the editor page). */
export default function DeleteGistDialog() {
  const deleteGistOrFile = useDeleteGistOrFile();

  return (
    <AlertDialog handle={deleteGistDialog}>
      {({ payload }) => {
        if (!payload) return null;

        const { gist, filename } = payload;
        const isFile = !deletesGist(gist, filename);
        const name = isFile ? getFileDisplayName(filename!) : getGistDisplayName(gist);

        return (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isFile ? "Delete file" : "Delete gist"}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {isFile ? "the file" : "the gist"} "{name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  deleteGistDialog.close();
                  deleteGistOrFile(gist, filename);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        );
      }}
    </AlertDialog>
  );
}
