import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

export function wikilinkCompletions(
    files: string[],
    context: CompletionContext,
): CompletionResult | null {
    const wikiWord = context.matchBefore(/\[\[([^\]]*)$/);
    if (!wikiWord) return null;

    if (wikiWord.from == wikiWord.to && !wikiWord.text.includes("[")) return null;

    const prefix = wikiWord.text.slice(2);
    const suggestions = files
        .filter((file) => file.endsWith(".md"))
        .map((file) => file.replace(/\.md$/, ""))
        .filter((file) => file.toLowerCase().includes(prefix.toLowerCase()))
        .map((file) => ({
            label: file,
            type: "file",
            apply: `${file}`,
        }));

    return {
        from: wikiWord.from + 2,
        to: wikiWord.to,
        options: suggestions,
        validFor: /^[^\]]*$/,
    };
}
