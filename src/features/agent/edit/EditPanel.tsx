import { editorViewAtom } from "@/features/editor/store";
import { useDraft } from "@/features/files/draft";
import { useActiveFile, useFileContent, useSaveFile } from "@/features/files/file";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { Toggle } from "@/shared/ui/toggle";
import { Chunk, getChunks, rejectChunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { useSelector } from "@tanstack/react-store";
import { Check, Diff, Loader2, X } from "lucide-react";
import { showPendingAgentDiffsAtom, useRunningMode } from "../model/store";

/** Counts the lines that were added and deleted between two versions of a file. */
function getDiffStats(original: string, updated: string) {
  const a = Text.of(original.split(/\r?\n/));
  const b = Text.of(updated.split(/\r?\n/));
  const countLines = (text: Text, from: number, to: number) =>
    from === to ? 0 : text.lineAt(to - 1).number - text.lineAt(from).number + 1;

  let additions = 0;
  let deletions = 0;
  for (const chunk of Chunk.build(a, b)) {
    additions += countLines(b, chunk.fromB, chunk.toB);
    deletions += countLines(a, chunk.fromA, chunk.toA);
  }

  return { additions, deletions };
}

/** Rejects all of the agent's pending edits. */
function rejectEdits() {
  const view = editorViewAtom.get();
  if (!view) return;

  for (const chunk of getChunks(view.state)?.chunks.toReversed() ?? []) {
    rejectChunk(view, chunk.fromB);
  }
}

/** Accepts (i.e. saves) or rejects the agent's pending edits to the file. */
export function EditPanel() {
  const file = useActiveFile();
  const content = useFileContent(file);
  const hasPendingAgentEdit = !!useDraft(file)?.hasPendingAgentEdit;
  const save = useSaveFile(file);
  const showDiffs = useSelector(showPendingAgentDiffsAtom);
  const isInProgress = useRunningMode() === "edit";
  const stats = hasPendingAgentEdit ? getDiffStats(file.savedContent, content) : null;

  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex gap-3 items-center">
        {isInProgress ? (
          <Loader2 className="h-4 w-4 animate-spin ml-1" />
        ) : (
          stats && (
            <div className="text-sm whitespace-nowrap flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400/80">+{stats.additions}</span>
              <span className="text-destructive dark:text-destructive/80">-{stats.deletions}</span>
            </div>
          )
        )}
        <Separator orientation="vertical" className="h-4 data-vertical:self-center" />
        <Toggle
          variant="outline"
          size="sm"
          className="size-6 min-w-6 p-0"
          pressed={showDiffs}
          onPressedChange={(pressed) => showPendingAgentDiffsAtom.set(pressed)}
          disabled={isInProgress}
          aria-label="Show changes"
        >
          <Diff className="size-3" />
        </Toggle>
      </div>
      <div className="flex gap-2">
        <Button
          size="xs"
          className="bg-green-600 text-white hover:bg-green-600/90 dark:bg-green-400/60"
          onClick={save}
          disabled={isInProgress}
        >
          <Check /> Accept all
        </Button>
        <Button size="xs" variant="destructive" onClick={rejectEdits} disabled={isInProgress}>
          <X /> Reject all
        </Button>
      </div>
    </div>
  );
}
