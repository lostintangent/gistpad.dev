import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

interface FenceConfig {
  type: string;
  color: string;
}

/** A badge (naming the block's type) that stands in for a collapsed block. */
class CodeFenceWidget extends WidgetType {
  constructor(readonly config: FenceConfig) {
    super();
  }

  eq(other: CodeFenceWidget) {
    return other.config.type === this.config.type;
  }

  toDOM() {
    const line = document.createElement("div");
    const badge = line.appendChild(document.createElement("span"));
    badge.className = "cm-code-fence";
    badge.textContent = this.config.type;
    badge.style.background = this.config.color;
    return line;
  }
}

const theme = EditorView.baseTheme({
  ".cm-code-fence": {
    color: "white",
    padding: "2px 4px",
    borderRadius: "4px",
    userSelect: "none",
    WebkitUserSelect: "none",
    fontWeight: "500",
  },
});

/** Collapses the fenced code blocks of the given types (e.g. whiteboards) into a badge. */
export const codeFences = (configs: FenceConfig[]) => {
  const decorate = (state: EditorState) => {
    const decorations: Range<Decoration>[] = [];

    syntaxTree(state).iterate({
      enter: (node) => {
        if (node.name !== "FencedCode") return;

        const info = node.node.getChild("CodeInfo");
        const config =
          info && configs.find(({ type }) => state.sliceDoc(info.from, info.to).trim() === type);
        // (A block that isn't closed runs to the end of the document, so it's left alone)
        if (!config || node.node.getChildren("CodeMark").length < 2) return false;

        const { from } = state.doc.lineAt(node.from);
        const { to } = state.doc.lineAt(node.to);
        const widget = new CodeFenceWidget(config);
        decorations.push(Decoration.replace({ widget, block: true }).range(from, to));
        return false;
      },
    });

    return Decoration.set(decorations, true);
  };

  // (Block decorations come from a state field, which here also follows the parser as it catches up)
  const collapsedFences = StateField.define<DecorationSet>({
    create: decorate,
    update: (decorations, tr) =>
      tr.docChanged || syntaxTree(tr.state) !== syntaxTree(tr.startState)
        ? decorate(tr.state)
        : decorations,
    provide: (field) => EditorView.decorations.from(field),
  });

  return [collapsedFences, theme];
};
