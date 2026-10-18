import type { EditorView } from "@codemirror/view";
import type { GistDocument } from "./document";
import { resetAiForDocument } from "@/features/ai/store";
import { resetComments } from "@/features/comments/store";
import { revisionAtom } from "./history/revision";
import { createAtom, useSelector } from "@tanstack/react-store";

// State for the open document (a gist file). Since document state is global, but only relevant
// to a single document, it's either tagged with the document's key (which ensures that state from a
// previously opened document is never applied to the current one), or reset when the document closes.

interface Draft {
  documentKey: string;
  /** The edited content of the document. */
  content: string;
  /** Files embedded in the document (e.g. whiteboards), which are saved alongside it. */
  embeddedFiles: Record<string, () => string>;
  /** Whether the draft includes AI edits, that the user hasn't accepted or rejected yet. */
  hasPendingAiEdit: boolean;
}

/** The unsaved changes to the open document (if it has any). */
export const draftAtom = createAtom<Draft | null>(null);

type DraftDocument = Pick<GistDocument, "documentKey" | "savedContent">;

/** The document's draft (if it has unsaved changes). */
export function useDraft(doc: DraftDocument) {
  return useSelector(draftAtom, (draft) => (draft?.documentKey === doc.documentKey ? draft : null));
}

/** Reads the document's draft (e.g. in an event handler). */
export function readDraft(doc: DraftDocument) {
  const draft = draftAtom.get();
  return draft?.documentKey === doc.documentKey ? draft : null;
}

/**
 * Updates the document's draft, relative to its saved content. And if the
 * changes revert the document back to its saved state, the draft is discarded.
 */
export function updateDraft(doc: DraftDocument, changes: Partial<Omit<Draft, "documentKey">>) {
  const { documentKey, savedContent } = doc;
  const current: Draft = readDraft(doc) ?? {
    documentKey,
    content: savedContent,
    embeddedFiles: {},
    hasPendingAiEdit: false,
  };

  const next = { ...current, ...changes };
  const isUnchanged = next.content === savedContent && Object.keys(next.embeddedFiles).length === 0;
  draftAtom.set(isUnchanged ? null : next);
}

/** Registers a file that's embedded in the document (e.g. a whiteboard), so it's saved alongside it. */
export function setEmbeddedFile(doc: DraftDocument, filename: string, read: () => string) {
  const embeddedFiles = readDraft(doc)?.embeddedFiles;
  updateDraft(doc, { embeddedFiles: { ...embeddedFiles, [filename]: read } });
}

/** The CodeMirror view of the open document, which AI commands and toolbars operate on. */
export const editorViewAtom = createAtom<EditorView | null>(null);

/** The state of the editor that toolbars reflect (e.g. a selection, which AI commands then apply to). */
export const editorStatusAtom = createAtom({ hasSelection: false, canUndo: false, canRedo: false });

/** A gist (file) whose editor should be focused, with the cursor at the end, once it opens. */
export const focusRequestAtom = createAtom<{ gistId: string; filename?: string } | null>(null);

/**
 * Resets the transient state of the previously open document (e.g. its selected comment,
 * or the revision being viewed), which is called whenever the user opens a different one.
 */
export function resetDocumentState() {
  resetComments();
  resetAiForDocument();
  revisionAtom.set(null);
}
