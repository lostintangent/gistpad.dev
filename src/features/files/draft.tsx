import type { ActiveFile } from "./file";
import { createAtom, useSelector } from "@tanstack/react-store";

/**
 * The unsaved changes to the active file. Since the draft is global, but only relevant to a single
 * file, it's tagged with the file's key (so a previous file's draft is never applied to the current one).
 */
interface Draft {
  fileKey: string;
  /** The edited content of the file. */
  content: string;
  /** Files embedded in the file (e.g. whiteboards), which are saved alongside it. */
  embeddedFiles: Record<string, () => string>;
  /** Whether the draft includes agent edits, that the user hasn't accepted or rejected yet. */
  hasPendingAgentEdit: boolean;
}

/** The active file's draft (if it has unsaved changes). */
export const draftAtom = createAtom<Draft | null>(null);

type DraftFile = Pick<ActiveFile, "key" | "savedContent">;

/** The file's draft (if it has unsaved changes). */
export function useDraft(file: DraftFile) {
  return useSelector(draftAtom, (draft) => (draft?.fileKey === file.key ? draft : null));
}

/** Reads the file's draft (e.g. in an event handler). */
export function readDraft(file: DraftFile) {
  const draft = draftAtom.get();
  return draft?.fileKey === file.key ? draft : null;
}

/**
 * Updates the file's draft, relative to its saved content. And if the
 * changes revert the file back to its saved state, the draft is discarded.
 */
export function updateDraft(file: DraftFile, changes: Partial<Omit<Draft, "fileKey">>) {
  const current: Draft = readDraft(file) ?? {
    fileKey: file.key,
    content: file.savedContent,
    embeddedFiles: {},
    hasPendingAgentEdit: false,
  };

  const next = { ...current, ...changes };
  const isUnchanged =
    next.content === file.savedContent && Object.keys(next.embeddedFiles).length === 0;
  draftAtom.set(isUnchanged ? null : next);
}

/** Registers a file that's embedded in the file (e.g. a whiteboard), so it's saved alongside it. */
export function setEmbeddedFile(file: DraftFile, filename: string, read: () => string) {
  const embeddedFiles = readDraft(file)?.embeddedFiles;
  updateDraft(file, { embeddedFiles: { ...embeddedFiles, [filename]: read } });
}
