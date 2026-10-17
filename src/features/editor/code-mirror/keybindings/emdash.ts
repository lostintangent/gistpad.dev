import { keymap } from "@codemirror/view";

/*
  This extension converts two consecutive hyphens "--" into an
  emdash "—" when the user types the second hyphen. But it ensures
  that it doesn't replace hyphens that are:
  1. At the beginning of a line
  2. Within inline code blocks (between backticks)
*/

export const emdash = keymap.of([
  {
    key: "-",
    run: (view) => {
      const { head } = view.state.selection.main;
      const line = view.state.doc.lineAt(head);
      const textBefore = line.text.slice(0, head - line.from);

      // (An odd number of backticks before the cursor means it's inside a code block)
      if (
        !textBefore.endsWith("-") ||
        textBefore.startsWith("-") ||
        (textBefore.match(/`/g) ?? []).length % 2 !== 0
      ) {
        return false;
      }

      // Replace the previous hyphen and this one with an emdash
      view.dispatch({
        changes: { from: head - 1, to: head, insert: "—" },
        selection: { anchor: head },
      });

      return true;
    },
  },
]);
