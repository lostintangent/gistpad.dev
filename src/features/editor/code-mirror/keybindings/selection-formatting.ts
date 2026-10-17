import { Prec } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";

/*
  This extension allows selecting a span of text, and applying
  formatting to it using the following key bindings:

  - Mod-i: Italic
  - Mod-b: Bold
  - Mod-u: Underline
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

export function formatSelection(
  view: EditorView,
  formatter: keyof typeof formatters,
  replacedText?: string,
  additionalParams?: { url: string },
): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;

  const selectedText = replacedText || view.state.sliceDoc(from, to);
  const formattedText = formatters[formatter](selectedText, additionalParams);

  view.dispatch({
    changes: { from, to, insert: formattedText },
    userEvent: "format",
    selection: { anchor: from, head: from + formattedText.length },
  });

  return true;
}

// Note: Prec.highest() is required in order to override the default CodeMirror keymap
export const selectionFormatting = Prec.highest(
  keymap.of([
    { key: "Mod-i", run: (view) => formatSelection(view, "italic") },
    { key: "Mod-b", run: (view) => formatSelection(view, "bold") },
    { key: "Mod-u", run: (view) => formatSelection(view, "underline") },
  ]),
);
