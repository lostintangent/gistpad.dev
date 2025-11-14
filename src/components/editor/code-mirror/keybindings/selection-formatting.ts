import { Prec } from "@codemirror/state";
import { EditorView, KeyBinding, keymap } from "@codemirror/view";

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
  link: (text: string, { url }) => `[${text}](${url})`,
  blockQuote: (text: string) =>
    text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n"),
};

type Formatter = keyof typeof formatters;

export function formatSelection(view: EditorView, formatter: Formatter, replacedText?: string, additionalParams?: any): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;

  const selectedText = replacedText || view.state.sliceDoc(from, to);
  const formattedText = formatters[formatter](selectedText, additionalParams);

  view.dispatch(
    view.state.update({
      changes: {
        from,
        to,
        insert: formattedText,
      },
      userEvent: "format",
      selection: {
        anchor: from,
        head: from + formattedText.length,
      },
    })
  );

  return true;
}

const createSelectionFormattingBinding = (
  key: string,
  formatter: Formatter
): KeyBinding => {
  return {
    key,
    run: (view) => formatSelection(view, formatter),
  };
};

// Note: Prec.highest() is required in order to override the default CodeMirror keymap
export const selectionFormatting = () =>
  Prec.highest(
    keymap.of([
      createSelectionFormattingBinding("Mod-i", "italic"),
      createSelectionFormattingBinding("Mod-b", "bold"),
      createSelectionFormattingBinding("Mod-u", "underline"),
    ])
  );
