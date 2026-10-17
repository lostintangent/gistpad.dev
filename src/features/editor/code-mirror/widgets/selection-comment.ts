import {
  Decoration,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

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
    button.className = "cm-selection-comment-button";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
    button.title = "Add comment with selected text";
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
    return this.selectedText === other.selectedText;
  }
}

/** Shows a button for commenting on the selected text, once it's at least 4 characters long. */
export const selectionComment = (onAddComment: (selectedText: string) => void) =>
  ViewPlugin.fromClass(
    class {
      decorations = Decoration.none;
      lastSelection = "";
      selectionTimeout?: number;

      constructor(readonly view: EditorView) {}

      update(update: ViewUpdate) {
        if (!update.selectionSet) return;

        const { from, to } = update.state.selection.main;
        const selectedText = update.state.sliceDoc(from, to);

        window.clearTimeout(this.selectionTimeout);
        if (selectedText === this.lastSelection) return;

        // If selection is empty or too short, clear decorations immediately
        if (selectedText.trim().length < 4) {
          this.decorations = Decoration.none;
          this.lastSelection = selectedText;
          return;
        }

        // Otherwise, the button is shown after a short delay
        this.selectionTimeout = window.setTimeout(() => {
          this.decorations = Decoration.set(
            Decoration.widget({
              widget: new CommentButtonWidget(selectedText, onAddComment),
              side: -1,
            }).range(from),
          );
          this.lastSelection = selectedText;
          // Force the editor to update its decorations
          this.view.update([]);
        }, 300);
      }

      destroy() {
        window.clearTimeout(this.selectionTimeout);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
