import { emojisQuery } from "@/shared/emojis";
import { queryClient } from "@/shared/query-client";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

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
