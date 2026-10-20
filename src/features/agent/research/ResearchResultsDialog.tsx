import { useAddAndOpenFile, useCreateAndOpenGist } from "@/features/gists/actions";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import type { ResearchTask } from "@/features/account/queries";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/shared/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Trash } from "lucide-react";
import type { ResearchResult } from "./research";

/** Displays the results of a research task (once they're fetched), which can be saved to a gist (or deleted). */
export default function ResearchResultsDialog({
  task,
  result,
  onClose,
  onDelete,
}: {
  task: ResearchTask;
  result: ResearchResult | undefined;
  onClose: () => void;
  /** Deletes the task, which is also how saved results are cleared. */
  onDelete: () => void;
}) {
  const createGist = useCreateAndOpenGist();
  const addFile = useAddAndOpenFile();

  // Results are saved to the gist that the research was started from (or a new gist)
  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: ({ title, filename, content }: ResearchResult) =>
      task.gistId
        ? addFile(task.gistId, filename, content)
        : createGist({ description: title, content }),
    onSuccess: onDelete,
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <p className="text-muted-foreground italic text-left">{task.topic}</p>
        </DialogHeader>
        <div className="flex-1 overflow-auto py-4">
          {result ? (
            <MarkdownPreview isReadOnly>{result.content}</MarkdownPreview>
          ) : (
            <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            onClick={() => result && save(result)}
            className="gap-2"
            disabled={!result || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button variant="destructive" onClick={onDelete} className="gap-2">
            <Trash className="h-4 w-4" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
