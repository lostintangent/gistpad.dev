import {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import emojiData from "@emoji-mart/data/sets/15/native.json";

interface EmojiData {
  emojis: {
    [key: string]: {
      id: string;
      name: string;
      keywords: string[];
      skins: { unified: string; native: string }[];
      version: number;
    };
  };
}

const emojis = Object.entries((emojiData as EmojiData).emojis).map(
  ([id, emoji]) => ({
    id,
    name: emoji.name,
    keywords: emoji.keywords || [],
    native: emoji.skins[0]?.native || "",
  })
);

export function emojiCompletions(
  context: CompletionContext
): CompletionResult | null {
  const emojiWord = context.matchBefore(/(?<=^|[\s([]):[^:\s]*$/);
  if (!emojiWord) return null;

  // Always show completion after typing ":"
  //if (emojiWord.from == emojiWord.to && !emojiWord.text.includes(":"))
  // return null;

  const query = emojiWord.text.slice(1);

  const options: Completion[] = emojis
    .filter(
      (emoji) =>
        !query ||
        emoji.id.includes(query.toLowerCase()) ||
        emoji.keywords.some((keyword) => keyword.includes(query.toLowerCase()))
    )
    .map((emoji) => ({
      label: `${emoji.native} :${emoji.id}:`,
      type: "emoji",
      apply: emoji.native,
      detail: emoji.name,
    }));

  return {
    from: emojiWord.from,
    options,
    validFor: /^:[\w]*$/,
  };
}
