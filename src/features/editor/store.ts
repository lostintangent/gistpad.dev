import type { EditorView } from "@codemirror/view";
import { aiStore } from "@/features/ai/store";
import { resetComments } from "@/features/comments/store";
import { persistedAtom } from "@/shared/persistedAtom";
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

export function useDraft(documentKey: string) {
  return useSelector(draftAtom, (draft) => (draft?.documentKey === documentKey ? draft : null));
}

/**
 * Updates the draft for a document, relative to its saved content. And if the
 * changes revert the document back to its saved state, the draft is discarded.
 */
export function updateDraft(
  documentKey: string,
  savedContent: string,
  changes: Partial<Omit<Draft, "documentKey">>,
) {
  draftAtom.set((draft) => {
    const current: Draft =
      draft?.documentKey === documentKey
        ? draft
        : { documentKey, content: savedContent, embeddedFiles: {}, hasPendingAiEdit: false };

    const next = { ...current, ...changes };
    const isUnchanged =
      next.content === savedContent && Object.keys(next.embeddedFiles).length === 0;

    return isUnchanged ? null : next;
  });
}

/** Registers a file that's embedded in the document (e.g. a whiteboard), so it's saved alongside it. */
export function setEmbeddedFile(
  documentKey: string,
  savedContent: string,
  filename: string,
  read: () => string,
) {
  const draft = draftAtom.get();
  const embeddedFiles = draft?.documentKey === documentKey ? draft.embeddedFiles : {};
  updateDraft(documentKey, savedContent, { embeddedFiles: { ...embeddedFiles, [filename]: read } });
}

/** The revision of the open document that's being viewed (if any), which is reset when it's closed. */
export const revisionAtom = createAtom<string | null>(null);

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
  revisionAtom.set(null);

  // AI edits and reviews apply to the document, so they can't continue once it's closed
  const { running } = aiStore.state;
  if (running?.mode === "edit" || running?.mode === "discuss") running.cancel();

  // AI edits and reviews are specific to a document, but the answer to a question remains
  // visible (since questions often span documents), as a new conversation.
  aiStore.setState((state) => ({
    ...state,
    edit: null,
    review: null,
    answer: state.answer && { ...state.answer, responseId: undefined },
  }));
}

// The editor page's layout

/** Whether the gist list sidebar is collapsed (desktop only). */
export const sidebarCollapsedAtom = persistedAtom("gistpad-sidebar-collapsed", false);

// The sidebar is sized in pixels (rather than as a percentage), so its width survives window
// resizes, and the workspace's panes divide whatever's left
export const SIDEBAR_MIN_WIDTH = 300;
export const SIDEBAR_MAX_WIDTH = 480;

export const clampSidebarWidth = (width: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));

/** The width of the expanded sidebar (desktop only), which is kept while it's collapsed. */
export const sidebarWidthAtom = persistedAtom("gistpad-sidebar-width", 325, {
  parse: (value) => {
    const width = Number(value);
    if (!Number.isFinite(width)) throw new Error(`Invalid sidebar width: ${value}`);
    return clampSidebarWidth(width);
  },
  stringify: String,
});

/** Whether the gist list is being shown, instead of the editor (mobile only). */
export const mobileSidebarOpenAtom = createAtom(false);

export const zenModeAtom = createAtom(false);

/** The width of the editor pane (as a percentage), when it's split with the preview. */
export const editorPanelSizeAtom = persistedAtom("gistpad-editor-width", 50);
