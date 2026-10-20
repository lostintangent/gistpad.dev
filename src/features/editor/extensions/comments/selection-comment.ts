import { Decoration, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { SELECTION_COMMENT } from "@/features/comments/threads";

const selectionSettled = StateEffect.define<null>();

// A widget that shows a comment bubble button
class CommentButtonWidget extends WidgetType {
  constructor(
    private readonly selectedText: string,
    private readonly onAddComment: (selectedText: string) => void,
  ) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-selection-comment-wrapper";

    const button = wrapper.appendChild(document.createElement("button"));
    button.type = "button";
    button.className = "cm-selection-comment-button";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
    button.title = SELECTION_COMMENT.title;
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onAddComment(this.selectedText);
    };
    // (Stopping the mousedown keeps the editor from handling it, and changing the selection)
    button.onmousedown = (e) => e.stopPropagation();

    return wrapper;
  }

  eq(other: CommentButtonWidget) {
    return this.selectedText === other.selectedText && this.onAddComment === other.onAddComment;
  }
}

const theme = EditorView.baseTheme({
  ".cm-selection-comment-wrapper": { display: "inline-block", position: "relative" },
  ".cm-selection-comment-button": {
    position: "absolute",
    right: "-55px",
    transform: "translateY(-140%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    zIndex: "100",
    transition: "all 0.2s ease",
  },
});

/** Shows a button for commenting on the selected text (once it's long enough to quote). */
export const selectionComment = (onAddComment: (selectedText: string) => void) => [
  ViewPlugin.fromClass(
    class {
      decorations = Decoration.none;
      selectionTimeout?: number;

      constructor(readonly view: EditorView) {
        this.schedule();
      }

      schedule() {
        window.clearTimeout(this.selectionTimeout);
        this.decorations = Decoration.none;

        const { from, to } = this.view.state.selection.main;
        if (this.view.state.sliceDoc(from, to).trim().length < SELECTION_COMMENT.minLength) return;

        this.selectionTimeout = window.setTimeout(() => {
          this.view.dispatch({ effects: selectionSettled.of(null) });
        }, SELECTION_COMMENT.delay);
      }

      update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged) {
          this.schedule();
          return;
        }

        if (
          update.transactions.some((tr) => tr.effects.some((effect) => effect.is(selectionSettled)))
        ) {
          const { from, to } = update.state.selection.main;
          const selectedText = update.state.sliceDoc(from, to);
          this.decorations = Decoration.set(
            Decoration.widget({
              widget: new CommentButtonWidget(selectedText, onAddComment),
              side: -1,
            }).range(from),
          );
        }
      }

      destroy() {
        window.clearTimeout(this.selectionTimeout);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  theme,
];
