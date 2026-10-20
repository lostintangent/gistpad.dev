import { EditorSelection, EditorState, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

// Files can start with (YAML) frontmatter, which holds the agent's settings for the file (see
// `features/agent/settings/frontMatter`), and which the editor hides unless the user opts to see it.

const FENCE = /^---\s*$/;

/** Where the document's frontmatter ends (i.e. its closing `---`), if it has any. */
export function frontMatterEnd(doc: Text): number | null {
  if (!FENCE.test(doc.line(1).text)) return null;

  // (The closing fence can't be the last line, since the content follows it)
  for (let number = 2; number < doc.lines; number++) {
    if (FENCE.test(doc.line(number).text)) return doc.line(number).to;
  }

  return null;
}

/** Where the hidden frontmatter ends: after the blank lines that follow it, so the content starts at the top. */
function hiddenEnd(doc: Text): number | null {
  const end = frontMatterEnd(doc);
  if (end === null) return null;

  // (All but the document's last line, so that there's always a line to type on)
  let line = doc.lineAt(end);
  while (line.number + 1 < doc.lines && !doc.line(line.number + 1).text.trim()) {
    line = doc.line(line.number + 1);
  }

  return line.to;
}

function hide(doc: Text): DecorationSet {
  const end = hiddenEnd(doc);
  return end === null
    ? Decoration.none
    : Decoration.set(Decoration.replace({ block: true }).range(0, end));
}

const hiddenFrontMatter = StateField.define<DecorationSet>({
  create: (state) => hide(state.doc),
  update: (decorations, tr) => (tr.docChanged ? hide(tr.newDoc) : decorations),
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Keeps the selection within the content, so that the hidden frontmatter can't be typed over (and
 * e.g. "select all" selects the content).
 */
const keepSelectionInContent = EditorState.transactionFilter.of((tr) => {
  const end = hiddenEnd(tr.newDoc);
  if (end === null) return tr;

  const min = end + 1;
  const { ranges, mainIndex } = tr.newSelection;
  if (ranges.every((range) => range.from >= min)) return tr;

  const clip = (pos: number) => Math.max(pos, min);
  const clipped = ranges.map((range) =>
    EditorSelection.range(clip(range.anchor), clip(range.head)),
  );
  return [tr, { selection: EditorSelection.create(clipped, mainIndex) }];
});

/** Hides the frontmatter (which is edited through the agent's settings instead). */
export const hideFrontMatter = [hiddenFrontMatter, keepSelectionInContent];
