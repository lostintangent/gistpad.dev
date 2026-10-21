import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import nspell from "nspell";

let dictionary: Promise<{ spell: ReturnType<typeof nspell>; words: Set<string> }> | undefined;

/**
 * Loads the English dictionary (which is large, and so is loaded the first time a document is
 * checked), along with the personal dictionary of the words it's missing (e.g. technical terms).
 */
function loadDictionary() {
  dictionary ??= Promise.all([
    import("./dictionaries/en.aff?raw"),
    import("./dictionaries/en.dic?raw"),
    import("./dictionaries/personal.dic?raw"),
  ])
    .then(([aff, dic, personal]) => ({
      spell: nspell(aff.default, dic.default).personal(personal.default),
      // (Personal words are accepted in any case, e.g. "github" as well as "GitHub")
      words: new Set(personal.default.split("\n").map((word) => word.toLowerCase())),
    }))
    .catch((error) => {
      console.error("Failed to load spell checker dictionary:", error);
      return { spell: nspell(""), words: new Set<string>() };
    });

  return dictionary;
}

// Code (both inline and fenced), HTML tags (and their attributes) and HTML entities (like &nbsp;)
// aren't spell checked
const excludedPatterns = [/```[\s\S]*?```|`[\s\S]*?`/g, /<[^>]*>/g, /&[a-zA-Z0-9#]+;/g];

// Words include straight and curly apostrophes, so that contractions are matched as a single word
// (e.g. "didn't" or "doesn’t").
const wordPattern = /\b[a-zA-Z'’]+\b/g;

// Words that are likely camelCase or PascalCase identifiers, all-uppercase words (likely constants
// or acronyms) and their plural or possessive forms (e.g. APIs, PRs, JC's), and capitalized words
// (likely proper nouns) aren't spell checked.
const ignoredWordPattern = /^[A-Z]?[a-z]+[A-Z]|^[A-Z]{2,}(?:['’]?s)?$|^[A-Z][a-z]+$/;

export const spellChecker = linter(async (view) => {
  const { spell, words } = await loadDictionary();
  const { doc } = view.state;

  // Process only if the document isn't too large
  if (doc.length > 100000) return [];

  const diagnostics: Diagnostic[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const excludedRegions = excludedPatterns.flatMap((pattern) =>
      Array.from(line.text.matchAll(pattern), ({ 0: text, index }) => [index, index + text.length]),
    );

    for (const { 0: word, index: from } of line.text.matchAll(wordPattern)) {
      const to = from + word.length;
      if (excludedRegions.some(([start, end]) => from < end && to > start)) continue;
      if (words.has(word.toLowerCase()) || ignoredWordPattern.test(word)) continue;

      // Normalize curly apostrophes to straight ones before checking
      const normalizedWord = word.replaceAll("’", "'");
      if (spell.correct(normalizedWord)) continue;

      diagnostics.push({
        from: line.from + from,
        to: line.from + to,
        severity: "warning",
        message: `Possible spelling error: "${word}".`,
        // Suggestions are slow to compute (up to hundreds of milliseconds per word), and
        // so they're only computed when the diagnostic is shown (e.g. on hover).
        get actions() {
          if (view.state.readOnly) return [];

          return spell
            .suggest(normalizedWord)
            .slice(0, 3)
            .map((suggestion) => ({
              name: `"${suggestion}"`,
              apply: (view: EditorView, from: number, to: number) =>
                !view.state.readOnly &&
                view.dispatch({ changes: { from, to, insert: suggestion } }),
            }));
        },
      });
    }
  }

  return diagnostics;
});
