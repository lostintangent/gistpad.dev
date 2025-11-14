import { Diagnostic, linter } from "@codemirror/lint";
import nspell from "nspell";

// Custom dictionary for words the user has added
const userDictionary = new Set<string>();

// Common programming terms to exclude from spell checking
const codeWords = new Set([
  // Programming/technical terms
  "dev", "workspaces", "workspace", "UX", "realtime", "UI",
  "API", "CLI", "JSON", "HTML", "CSS", "JS", "TS", "React", "Vue", "Angular",
  "async", "undoable", "refactoring", "refactorings", "YOLO", "spidering", "ambiently",
  "OSS", "roadmap", "roadmaps", "CI", "CD", "SaaS", "PaaS", "IaaS", "K8s",
  "Kubernetes", "GitHub", "GitLab", "Bitbucket", "DevOps", "NoSQL", "SQL",
  "CRUD", "REST", "GraphQL", "microservices", "monorepo", "polyrepo", "frontend",
  "backend", "fullstack", "cloud", "serverless", "container", "containers",
  "commoditization", "differentiator", "differentiators", "changelog", "readme",
  "gist", "gists", "npm", "yarn", "pnpm", "webpack", "babel", "typescript",
  "autocompletion", "deeplink", "deeplinks", "codebase", "wikilinks", "wikilink",
  "markdown", "linter", "linters", "linting", "linted", "lint", "CI/CD",
  "headless", "headlessly", "Anthropic", "OpenAI", "Google", "Microsoft", "Amazon",
  "PR", "PRs", "papercut", "papercuts", "integrations", "devs", "github", "waitlist",
  "fullscreen", "CLIs", "padawan", "devtool", "commoditized", "learnings", "OKRs", "KPIs", "centric",
  "dogfooding", "dogfood", "dogfooder", "wishlist", "superfan", "superfans", "blindspot", "blindspots",
  "onboarding", "offboarding", "onboarded", "gistpad", "impactful", "operationalize",
  "incentivized", "transformative", "influencers", "underserved", "outsized",
  "Codespaces", "Jupyter", "repo", "perf", "codebases", "serendipitously",
  "APIs", "SMBs", "auth", "agentic", "utils", "supabase", "specing", "manwha", "curation",
  "seinen", "shonen", "parallelizing", "assignees", "config", "enablement",

  // Common HTML elements
  "div", "span", "img", "src", "alt", "href", "rel", "br", "hr", "ul", "ol", "li",
  "table", "tr", "td", "th", "thead", "tbody", "tfoot", "form", "input", "label",
  "select", "option", "button", "textarea", "fieldset", "legend", "header", "footer",
  "nav", "main", "section", "article", "aside", "figure", "figcaption", "blockquote",
  "cite", "pre", "code", "iframe", "canvas", "audio", "video", "source", "track",

  // Common HTML attributes
  "id", "class", "style", "title", "aria", "data", "href", "src", "alt", "width",
  "height", "type", "value", "name", "placeholder", "action", "method", "target",
  "role", "tabindex", "disabled", "checked", "selected", "readonly", "required",
  "autocomplete", "autofocus", "cols", "rows", "max", "min", "step", "pattern",
  "accept", "for", "charset", "content", "http", "https", "equiv", "lang", "dir", "defer",
  "async", "crossorigin", "integrity", "media", "preload", "rel", "sizes", "srcset"
]);

// Create a dictionary loader for nspell
let dictionary: any = null;

// Initialize the spell checker with the English dictionary
async function loadDictionary() {
  try {
    // Load dictionary files
    const [affData, dicData] = await Promise.all([
      fetch('/dictionaries/en.aff').then(r => r.text()),
      fetch('/dictionaries/en.dic').then(r => r.text())
    ]);

    // Create the spell checker
    dictionary = nspell(affData, dicData);

    // Add common programming terms to the dictionary
    codeWords.forEach(word => dictionary.add(word));
  } catch (error) {
    console.error("Failed to load spell checker dictionary:", error);
    // Initialize with an empty dictionary if loading fails
    dictionary = nspell("");
  }
}

// Start loading the dictionary right away
loadDictionary();

// Extract words from text, respecting markdown formatting and HTML
function extractWords(text: string): { word: string; from: number; to: number }[] {
  const words: { word: string; from: number; to: number }[] = [];
  // Include straight and curly apostrophes so contractions are matched as a
  // single word (e.g. "didn't" or "doesn’t").
  const regex = /\b[a-zA-Z'’]+\b/g;

  // Regions to exclude from spell checking
  const excludedRegions: { from: number; to: number }[] = [];

  // 1. Skip checking within code blocks (both inline and fenced blocks)
  const codeBlockRegex = /```[\s\S]*?```|`[\s\S]*?`/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    excludedRegions.push({ from: match.index, to: match.index + match[0].length });
  }

  // 2. Skip checking within HTML tags (both opening and closing tags, and their attributes)
  const htmlTagRegex = /<[^>]*>/g;
  while ((match = htmlTagRegex.exec(text)) !== null) {
    excludedRegions.push({ from: match.index, to: match.index + match[0].length });
  }

  // 3. Skip checking within HTML entities (like &nbsp;)
  const htmlEntityRegex = /&[a-zA-Z0-9#]+;/g;
  while ((match = htmlEntityRegex.exec(text)) !== null) {
    excludedRegions.push({ from: match.index, to: match.index + match[0].length });
  }

  // Extract words outside excluded regions
  while ((match = regex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;

    // Check if this word is inside an excluded region
    const inExcludedRegion = excludedRegions.some(region =>
      (from >= region.from && from < region.to) ||
      (to > region.from && to <= region.to) ||
      (from <= region.from && to >= region.to)
    );

    if (!inExcludedRegion) {
      words.push({ word: match[0], from, to });
    }
  }

  return words;
}

// The actual spell checker linter
export const spellChecker = linter(view => {
  const { state } = view;
  const diagnostics: Diagnostic[] = [];

  // Process only if the document isn't too large
  if (state.doc.length > 100000) return [];

  // Process each line of the document
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const lineText = line.text;

    // Extract words from the line
    const words = extractWords(lineText);

    // Check each word
    for (const { word, from, to } of words) {
      const lowercaseWord = word.toLowerCase();

      // First check against our user dictionary
      if (userDictionary.has(lowercaseWord)) continue;

      // Skip checking words that are likely code-related
      if (codeWords.has(lowercaseWord)) continue;

      // Skip checking words that contain numbers or special characters. Apostrophes
      // are allowed so that contractions can be spell checked.
      if (/[0-9@#$%^&*()_+\-=\[\]{};:"\\|,.<>\/?]/.test(word)) continue;

      // Skip checking words that are likely camelCase or PascalCase identifiers
      if (/^[a-z]+[A-Z]/.test(word) || /^[A-Z][a-z]+[A-Z]/.test(word)) continue;

      // Skip very short words
      // if (word.length <= 2) continue;

      // Skip all-uppercase words (likely constants or acronyms) and their
      // optional plural or possessive forms (e.g. APIs, PRs, JC's)
      if (/^[A-Z][A-Z]+(?:s|'s|’s)?$/.test(word)) continue;

      // Skip words that start with a capital letter (likely proper nouns)
      if (/^[A-Z][a-z]+$/.test(word)) continue;

      // Skip words that look like HTML tags or attributes
      if (word.startsWith('</') || word.startsWith('<') || word.includes('=')) continue;

      // Skip words that might be HTML entities
      if (word.startsWith('&') && word.endsWith(';')) continue;

      // Normalize curly apostrophes to straight ones before checking
      const normalizedWord = word.replace(/’/g, "'");

      // Use nspell to check for misspellings
      if (dictionary && !dictionary.correct(normalizedWord)) {
        // Get suggestions from the dictionary
        const suggestions = dictionary.suggest(normalizedWord).slice(0, 3); // Limit to top 3 suggestions

        // Create actions for each suggestion
        const suggestionActions = suggestions.map(suggestion => ({
          name: `"${suggestion}"`,
          apply(view, from, to) {
            view.dispatch({
              changes: { from, to, insert: suggestion }
            });
          }
        }));

        // Create a diagnostic with the suggestions
        diagnostics.push({
          from: line.from + from,
          to: line.from + to,
          severity: "warning",
          message: `Possible spelling error: "${word}".`,
          actions: suggestionActions
        });

        continue;
      }
    }
  }

  return diagnostics;
});

import { StateEffect, StateField } from "@codemirror/state";

// Effect to trigger re-linting
export const lintTime = StateEffect.define<number>();

// State field to track when to re-lint
export const lintTimeField = StateField.define<number>({
  create: () => Date.now(),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(lintTime)) return e.value;
    }
    return value;
  }
});