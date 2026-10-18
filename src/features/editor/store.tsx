import type { EditorView } from "@codemirror/view";
import { createAtom } from "@tanstack/react-store";

/** The CodeMirror view of the active file, which AI commands and toolbars operate on. */
export const editorViewAtom = createAtom<EditorView | null>(null);

/** The state of the editor that toolbars reflect (e.g. a selection, which AI commands then apply to). */
export const editorStatusAtom = createAtom({ hasSelection: false, canUndo: false, canRedo: false });
