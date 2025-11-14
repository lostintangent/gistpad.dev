import { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/*
  This extension converts two consecutive hyphens "--" into an
  emdash "—" when the user types the second hyphen. But it ensures
  that it doesn't replace hyphens that are:
  1. At the beginning of a line
  2. Within inline code blocks (between backticks)
*/

export const emdash: Extension = keymap.of([
  {
    key: "-",
    run: (view) => {
      const { state } = view;
      const { doc, selection } = state;
      const { head } = selection.main;

      // If cursor isn't at the end of text, don't do anything special
      if (head === 0) return false;

      // Check if the previous character is a hyphen
      const prevChar = doc.sliceString(head - 1, head);
      if (prevChar !== "-") return false;

      // Find the beginning of the current line
      let lineStart = head - 1;
      while (
        lineStart > 0 &&
        doc.sliceString(lineStart - 1, lineStart) !== "\n"
      ) {
        lineStart--;
      }

      // Check if the line starts with a dash
      const firstCharOfLine = doc.sliceString(lineStart, lineStart + 1);
      if (firstCharOfLine === "-") return false;

      // Count backticks before the cursor position to determine if we're in a code block
      const lineText = doc.sliceString(lineStart, head);
      const backtickCount = (lineText.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) return false; // We're inside a code block

      // Replace the previous hyphen and this one with an emdash
      view.dispatch({
        changes: {
          from: head - 1,
          to: head,
          insert: "—",
        },
        selection: { anchor: head },
      });

      return true;
    }
  },
]);
