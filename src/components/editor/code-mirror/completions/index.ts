import { autocompletion } from "@codemirror/autocomplete";
import { Extension } from "@codemirror/state";
import { emojiCompletions } from "./emoji";
import { frontmatterCompletions } from "./frontmatter";
import { wikilinkCompletions } from "./wikilink";

export function createEditorCompletions(files: string[], isAiEnabled: boolean = false): Extension {
    return autocompletion({
        override: [
            ...(isAiEnabled ? [frontmatterCompletions] : []),
            wikilinkCompletions.bind(null, files),
            emojiCompletions,
        ],
    });
}
