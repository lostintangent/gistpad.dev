import { autocompletion } from "@codemirror/autocomplete";
import { emojiCompletions } from "./emoji";
import { frontmatterCompletions } from "./frontmatter";
import { wikilinkCompletions } from "./wikilink";

export const createEditorCompletions = (files: string[], isAiEnabled: boolean) =>
  autocompletion({
    override: [
      ...(isAiEnabled ? [frontmatterCompletions] : []),
      wikilinkCompletions.bind(null, files),
      emojiCompletions,
    ],
  });
