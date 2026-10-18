import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import nspell from "nspell";

// Common programming terms to exclude from spell checking
const codeWords = new Set([
  // Programming/technical terms
  "dev",
  "workspaces",
  "workspace",
  "UX",
  "realtime",
  "UI",
  "API",
  "CLI",
  "JSON",
  "HTML",
  "CSS",
  "JS",
  "TS",
  "React",
  "Vue",
  "Angular",
  "async",
  "undoable",
  "refactoring",
  "refactorings",
  "YOLO",
  "spidering",
  "ambiently",
  "OSS",
  "roadmap",
  "roadmaps",
  "CI",
  "CD",
  "SaaS",
  "PaaS",
  "IaaS",
  "K8s",
  "Kubernetes",
  "GitHub",
  "GitLab",
  "Bitbucket",
  "DevOps",
  "NoSQL",
  "SQL",
  "CRUD",
  "REST",
  "GraphQL",
  "microservices",
  "monorepo",
  "polyrepo",
  "frontend",
  "backend",
  "fullstack",
  "cloud",
  "serverless",
  "container",
  "containers",
  "commoditization",
  "differentiator",
  "differentiators",
  "changelog",
  "readme",
  "gist",
  "gists",
  "npm",
  "yarn",
  "pnpm",
  "webpack",
  "babel",
  "typescript",
  "autocompletion",
  "deeplink",
  "deeplinks",
  "codebase",
  "wikilinks",
  "wikilink",
  "markdown",
  "linter",
  "linters",
  "linting",
  "linted",
  "lint",
  "CI/CD",
  "headless",
  "headlessly",
  "Anthropic",
  "OpenAI",
  "Google",
  "Microsoft",
  "Amazon",
  "PR",
  "PRs",
  "papercut",
  "papercuts",
  "integrations",
  "devs",
  "github",
  "waitlist",
  "fullscreen",
  "CLIs",
  "padawan",
  "devtool",
  "commoditized",
  "learnings",
  "OKRs",
  "KPIs",
  "centric",
  "dogfooding",
  "dogfood",
  "dogfooder",
  "wishlist",
  "superfan",
  "superfans",
  "blindspot",
  "blindspots",
  "onboarding",
  "offboarding",
  "onboarded",
  "gistpad",
  "impactful",
  "operationalize",
  "incentivized",
  "transformative",
  "influencers",
  "underserved",
  "outsized",
  "Codespaces",
  "Jupyter",
  "repo",
  "perf",
  "codebases",
  "serendipitously",
  "APIs",
  "SMBs",
  "auth",
  "agentic",
  "utils",
  "supabase",
  "specing",
  "manwha",
  "curation",
  "seinen",
  "shonen",
  "parallelizing",
  "assignees",
  "config",
  "enablement",

  // Common HTML elements
  "div",
  "span",
  "img",
  "src",
  "alt",
  "href",
  "rel",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "table",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "form",
  "input",
  "label",
  "select",
  "option",
  "button",
  "textarea",
  "fieldset",
  "legend",
  "header",
  "footer",
  "nav",
  "main",
  "section",
  "article",
  "aside",
  "figure",
  "figcaption",
  "blockquote",
  "cite",
  "pre",
  "code",
  "iframe",
  "canvas",
  "audio",
  "video",
  "source",
  "track",

  // Common HTML attributes
  "id",
  "class",
  "style",
  "title",
  "aria",
  "data",
  "width",
  "height",
  "type",
  "value",
  "name",
  "placeholder",
  "action",
  "method",
  "target",
  "role",
  "tabindex",
  "disabled",
  "checked",
  "selected",
  "readonly",
  "required",
  "autocomplete",
  "autofocus",
  "cols",
  "rows",
  "max",
  "min",
  "step",
  "pattern",
  "accept",
  "for",
  "charset",
  "content",
  "http",
  "https",
  "equiv",
  "lang",
  "dir",
  "defer",
  "crossorigin",
  "integrity",
  "media",
  "preload",
  "sizes",
  "srcset",
]);

let dictionary: Promise<ReturnType<typeof nspell>> | undefined;

/** Loads the English dictionary, which is large, and so it's loaded the first time a document is checked. */
function loadDictionary() {
  dictionary ??= Promise.all([
    import("@/assets/dictionaries/en.aff", { with: { type: "text" } }),
    import("@/assets/dictionaries/en.dic", { with: { type: "text" } }),
  ])
    .then(([aff, dic]) => nspell(aff.default, dic.default).personal([...codeWords].join("\n")))
    .catch((error) => {
      console.error("Failed to load spell checker dictionary:", error);
      return nspell("");
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
  const dictionary = await loadDictionary();
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
      if (codeWords.has(word.toLowerCase()) || ignoredWordPattern.test(word)) continue;

      // Normalize curly apostrophes to straight ones before checking
      const normalizedWord = word.replaceAll("’", "'");
      if (dictionary.correct(normalizedWord)) continue;

      diagnostics.push({
        from: line.from + from,
        to: line.from + to,
        severity: "warning",
        message: `Possible spelling error: "${word}".`,
        // Suggestions are slow to compute (up to hundreds of milliseconds per word), and
        // so they're only computed when the diagnostic is shown (e.g. on hover).
        get actions() {
          return dictionary
            .suggest(normalizedWord)
            .slice(0, 3)
            .map((suggestion) => ({
              name: `"${suggestion}"`,
              apply: (view: EditorView, from: number, to: number) =>
                view.dispatch({ changes: { from, to, insert: suggestion } }),
            }));
        },
      });
    }
  }

  return diagnostics;
});
