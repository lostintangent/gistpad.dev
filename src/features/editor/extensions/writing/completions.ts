import { frontMatterCompletions } from "@/features/agent/settings/frontMatter/completions";
import { emojisQuery } from "@/shared/emojis";
import { getFileDisplayName } from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";

/** Completes wikilinks (i.e. `[[page`) with the gist's other markdown files. */
export function wikilinkCompletions(
  files: string[],
  context: CompletionContext,
): CompletionResult | null {
  const wikiWord = context.matchBefore(/\[\[([^\]]*)$/);
  if (!wikiWord) return null;

  const prefix = wikiWord.text.slice(2).toLowerCase();
  return {
    from: wikiWord.from + 2,
    options: files
      .map(getFileDisplayName)
      .filter((file) => file.toLowerCase().includes(prefix))
      .map((file) => ({ label: file, type: "file" })),
    validFor: /^[^\]]*$/,
  };
}

/** Completes emoji shortcodes (e.g. `:tada:`), whose data is loaded the first time it's needed. */
export async function emojiCompletions(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const emojiWord = context.matchBefore(/(?<=^|[\s([]):[^:\s]*$/);
  if (!emojiWord) return null;

  const emojis = await queryClient.query(emojisQuery);
  const query = emojiWord.text.slice(1).toLowerCase();

  return {
    from: emojiWord.from,
    options: emojis
      .filter(
        (emoji) =>
          !query ||
          emoji.id.includes(query) ||
          emoji.keywords.some((keyword) => keyword.includes(query)),
      )
      .map((emoji) => ({
        label: `${emoji.native} :${emoji.id}:`,
        type: "emoji",
        apply: emoji.native,
        detail: emoji.name,
      })),
    validFor: /^:\w*$/,
  };
}

/** The slash commands, which are replaced by what they insert. */
const COMMANDS: Completion[] = [
  { label: "/task", detail: "Add a task", apply: "- [ ] ", type: "command" },
  { label: "/bookmark", detail: "Add a bookmark", apply: "{#}", type: "command" },
];

/** Completes slash commands (e.g. `/task`) at the start of a line (so a URL's slashes aren't matched). */
export function slashCompletions(context: CompletionContext): CompletionResult | null {
  const command = context.matchBefore(/(?<=^\s*)\/\w*$/);
  if (!command) return null;

  return { from: command.from, options: COMMANDS, validFor: /^\/\w*$/ };
}

/** The editor's completions (the agent's settings are only completed once it's configured). */
export const editorCompletions = (files: string[], isAgentEnabled: boolean) =>
  autocompletion({
    override: [
      ...(isAgentEnabled ? [frontMatterCompletions] : []),
      wikilinkCompletions.bind(null, files),
      emojiCompletions,
      slashCompletions,
    ],
  });
