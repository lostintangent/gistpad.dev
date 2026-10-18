import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { getFileDisplayName } from "@/shared/github";

export function wikilinkCompletions(
  /** The markdown files that can be linked to. */
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
