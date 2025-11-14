import { Extension } from "@codemirror/state";
import { emdash } from "./emdash";
import { selectionFormatting } from "./selection-formatting";

// This extension returns the set of keybindings for the editor.
export function createEditorKeybindings(): Extension {
    return [
        emdash,
        selectionFormatting(),
    ]
}
