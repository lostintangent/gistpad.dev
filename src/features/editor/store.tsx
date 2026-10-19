import type { EditorView } from "@codemirror/view";
import { createAtom } from "@tanstack/react-store";

/** The CodeMirror view of the active file, which agent commands and toolbars operate on. */
export const editorViewAtom = createAtom<EditorView | null>(null);

/** The state of the editor that toolbars reflect (e.g. a selection, which agent commands then apply to). */
export const editorStatusAtom = createAtom({ hasSelection: false, canUndo: false, canRedo: false });
