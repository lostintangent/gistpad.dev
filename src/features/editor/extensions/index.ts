import { assetUrls } from "./assets/asset-urls";
import { codeFences } from "./markdown/code-fences";
import { commentHighlights } from "./comments/comment-highlights";
import { editorCompletions } from "./writing/completions";
import { emdash } from "./writing/emdash";
import { selectionFormatting } from "./writing/formatting";
import { hideFrontMatter } from "./markdown/frontmatter";
import { imagePreview } from "./markdown/image-preview";
import { imageUpload } from "./assets/image-upload";
import { clickableLinks } from "./markdown/links";
import { mathResults } from "./markdown/math";
import { selectionComment } from "./comments/selection-comment";
import { spellChecker } from "./writing/spell-checker";
import { formattingBubble } from "../FormattingToolbar";
import type { Preferences } from "@/features/account/queries";
import { openComments } from "@/features/comments/store";
import type { CommentHighlights } from "@/features/comments/threads";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { unifiedMergeView } from "@codemirror/merge";
import { searchKeymap } from "@codemirror/search";
import { Compartment, type Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  scrollPastEnd,
  tooltips,
} from "@codemirror/view";

// The editor's extensions: the base that every editor has, and the compartments for what's
// reconfigured while one is open. (`EditorPane` hosts the editor, and keeps them configured.)

/**
 * CodeMirror's basic setup (copied here, as it recommends, rather than configured), without the
 * code editing features that don't suit prose, e.g. closing brackets, or highlighting the
 * selection's other matches. Its gutter is a preference (see `gutter`).
 */
const setup = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  bracketMatching(),
  highlightActiveLine(),
  keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...lintKeymap, indentWithTab]),
];

/** The gutter, which numbers the lines (and folds sections), when the user opts to see it. */
const gutter = [lineNumbers(), highlightActiveLineGutter(), foldGutter(), keymap.of(foldKeymap)];

export const baseExtensions: Extension = [
  setup,
  // (GitHub flavored markdown, which is what the preview renders)
  yamlFrontmatter({ content: markdown({ base: markdownLanguage }) }),
  EditorView.lineWrapping,
  // Tooltips (e.g. the formatting bubble, or completions) are positioned within the editor
  // (absolutely, since the panels are transformed on mobile, which fixed positioning doesn't
  // survive), and kept within its scroller (since the pane clips them) by flipping to whichever
  // side of their position has the room
  tooltips({
    position: "absolute",
    tooltipSpace: (view) => view.scrollDOM.getBoundingClientRect(),
  }),
  assetUrls,
  codeFences([
    { type: "tldraw", color: "purple" },
    { type: "toc", color: "blue" },
  ]),
  imagePreview,
  emdash,
  selectionFormatting,
  mathResults,
  scrollPastEnd(),
];

/** The extensions for the editor's theme, the user's preferences, and the file that's open. */
export const dynamic = new Compartment();

export function dynamicExtensions({
  theme,
  preferences,
  gistId,
  otherFiles,
  isAgentEnabled,
  openWikilink,
  highlights,
  isMobile,
}: {
  theme: Extension;
  preferences: Preferences;
  gistId: string | undefined;
  /** The gist's other markdown files (which wikilinks complete to). */
  otherFiles: string[];
  isAgentEnabled: boolean;
  openWikilink: (link: string) => void;
  highlights: CommentHighlights | undefined;
  isMobile: boolean;
}): Extension {
  return [
    theme,
    preferences.showLineNumbers ? gutter : [],
    preferences.showFrontmatter ? [] : hideFrontMatter,
    preferences.isSpellcheckEnabled ? spellChecker : [],
    gistId ? imageUpload(gistId, preferences.pasteImagesAsHtml) : [],
    editorCompletions(otherFiles, isAgentEnabled),
    clickableLinks(openWikilink),
    highlights ? commentHighlights(highlights) : [],
    // The selection can be formatted (or commented on) from a bubble above it, except on mobile,
    // where a comment button is shown beside it instead (and the toolbar formats it)
    isMobile ? selectionComment((text) => openComments({ quote: text })) : formattingBubble,
  ];
}

/** The diff of the file against its saved content (or of a revision against the one before it). */
export const diff = new Compartment();

export function diffExtension({
  original,
  isRevision,
  collapseUnchanged,
}: {
  original: string;
  /** Whether a past revision is open (whose changes can't be accepted or rejected). */
  isRevision: boolean;
  collapseUnchanged: boolean;
}): Extension {
  return unifiedMergeView({
    original,
    mergeControls: !isRevision,
    collapseUnchanged: collapseUnchanged ? {} : undefined,
    allowInlineDiffs: true,
  });
}
