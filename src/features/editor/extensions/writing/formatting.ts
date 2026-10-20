import { Prec } from "@codemirror/state";
import { type Command, type EditorView, keymap } from "@codemirror/view";

/*
  This extension allows selecting a span of text, and applying
  formatting to it using the following key bindings:

  - Mod-b: Bold
  - Mod-i: Italic
  - Mod-u: Underline
  - Mod-Shift-x: Strikethrough
  - Mod-e: Code
  - Mod-Shift-. (i.e. Mod->): Block quote
  - Mod-Shift-k: Link (whose URL is then typed)
*/

const formatters = {
  bold: (text: string) => `**${text}**`,
  italic: (text: string) => `*${text}*`,
  underline: (text: string) => `<u>${text}</u>`,
  strikethrough: (text: string) => `~~${text}~~`,
  code: (text: string) => `\`${text}\``,
  link: (text: string, params?: { url: string }) => `[${text}](${params?.url ?? ""})`,
  blockQuote: (text: string) =>
    text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n"),
};

export type Formatter = keyof typeof formatters;

export function formatSelection(
  view: EditorView,
  formatter: Formatter,
  replacedText?: string,
  additionalParams?: { url: string },
): boolean {
  const { from, to } = view.state.selection.main;
  if (view.state.readOnly || from === to) return false;

  const selectedText = replacedText || view.state.sliceDoc(from, to);
  const formattedText = formatters[formatter](selectedText, additionalParams);

  view.dispatch({
    changes: { from, to, insert: formattedText },
    userEvent: "format",
    selection: { anchor: from, head: from + formattedText.length },
  });

  return true;
}

const format =
  (formatter: Formatter): Command =>
  (view) =>
    formatSelection(view, formatter);

/** Links the selected text, leaving the cursor between the link's (empty) parentheses, for its URL. */
const linkSelection: Command = (view) => {
  const { from, to } = view.state.selection.main;
  if (view.state.readOnly || from === to) return false;

  const link = formatters.link(view.state.sliceDoc(from, to));
  view.dispatch({
    changes: { from, to, insert: link },
    userEvent: "format",
    selection: { anchor: from + link.length - 1 },
  });

  return true;
};

// Note: Prec.highest() is required in order to override the default CodeMirror keymap
export const selectionFormatting = Prec.highest(
  keymap.of([
    { key: "Mod-b", run: format("bold") },
    { key: "Mod-i", run: format("italic") },
    { key: "Mod-u", run: format("underline") },
    { key: "Mod-Shift-x", run: format("strikethrough") },
    { key: "Mod-e", run: format("code") },
    { key: "Mod-Shift-.", run: format("blockQuote") },
    { key: "Mod-Shift-k", run: linkSelection },
  ]),
);
