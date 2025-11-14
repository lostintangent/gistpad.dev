import { Extension } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType
} from "@codemirror/view";

// A widget that shows a comment bubble button
class CommentButtonWidget extends WidgetType {
    constructor(
        private readonly selectedText: string,
        private readonly onAddComment: (selectedText: string) => void
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const wrapper = document.createElement("div");
        wrapper.className = "cm-selection-comment-wrapper";

        const button = document.createElement("button");
        button.className = "cm-selection-comment-button";
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
        button.title = "Add comment with selected text";

        const handleClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            this.onAddComment(this.selectedText);
        };

        button.addEventListener("click", handleClick);
        button.addEventListener("mousedown", e => e.stopPropagation());

        wrapper.appendChild(button);
        return wrapper;
    }

    eq(other: CommentButtonWidget): boolean {
        return this.selectedText === other.selectedText;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

// Helper function to create a plugin that displays comment button on selection
export const selectionComment = (onAddComment: (selectedText: string) => void): Extension => {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            selectionTimeout: number | null = null;
            lastSelection: string = "";
            view: EditorView;
            readonly THROTTLE_DELAY = 300; // 300ms delay before showing button

            constructor(view: EditorView) {
                this.view = view;
                this.decorations = Decoration.set([]);
            }

            private shouldShowButton(selectedText: string): boolean {
                return selectedText.trim().length >= 4;
            }

            private createButton(selectedText: string, pos: number): DecorationSet {
                return Decoration.set([
                    Decoration.widget({
                        widget: new CommentButtonWidget(selectedText, onAddComment),
                        block: false,
                        side: -1
                    }).range(pos)
                ]);
            }

            update(update: ViewUpdate) {
                if (!update.selectionSet) {
                    return;
                }

                const selection = update.state.selection.main;
                const selectedText = update.state.sliceDoc(selection.from, selection.to);

                // Clear any existing timeout
                if (this.selectionTimeout) {
                    window.clearTimeout(this.selectionTimeout);
                    this.selectionTimeout = null;
                }

                // Don't update if it's the same selection
                if (selectedText === this.lastSelection) {
                    return;
                }

                // If selection is empty or too short, clear decorations immediately
                if (!this.shouldShowButton(selectedText)) {
                    this.decorations = Decoration.set([]);
                    this.lastSelection = selectedText;
                    return;
                }

                // Store the current selection and position
                const currentSelection = selectedText;
                const currentPos = selection.from;

                // Throttle updates with a delay
                this.selectionTimeout = window.setTimeout(() => {
                    if (this.shouldShowButton(currentSelection)) {
                        this.decorations = this.createButton(currentSelection, currentPos);
                        this.lastSelection = currentSelection;
                        // Force the editor to update its decorations
                        this.view.update([]);
                    }
                }, this.THROTTLE_DELAY);
            }

            destroy() {
                if (this.selectionTimeout) {
                    window.clearTimeout(this.selectionTimeout);
                }
            }
        },
        {
            decorations: v => v.decorations,
            eventHandlers: {
                mousedown(e: MouseEvent) {
                    const target = e.target as HTMLElement;
                    if (target.closest(".cm-selection-comment-button")) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }
        }
    );
};