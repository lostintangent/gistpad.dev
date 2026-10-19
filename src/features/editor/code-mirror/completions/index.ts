import { autocompletion } from "@codemirror/autocomplete";
import { emojiCompletions } from "./emoji";
import { frontMatterCompletions } from "@/features/agent/settings/frontMatter/completions";
import { wikilinkCompletions } from "./wikilink";

export const createEditorCompletions = (files: string[], isAgentEnabled: boolean) =>
  autocompletion({
    override: [
      ...(isAgentEnabled ? [frontMatterCompletions] : []),
      wikilinkCompletions.bind(null, files),
      emojiCompletions,
    ],
  });
