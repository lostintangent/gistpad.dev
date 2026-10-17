import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

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
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -3))
      .filter((file) => file.toLowerCase().includes(prefix))
      .map((file) => ({ label: file, type: "file" })),
    validFor: /^[^\]]*$/,
  };
}
