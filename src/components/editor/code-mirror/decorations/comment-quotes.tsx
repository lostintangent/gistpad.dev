import { commentTooltipService } from "@/components/comments/CommentTooltipService";
import {
  COMMENT_ID_ATTR,
  findQuoteMatches,
  getHighlightClasses,
  QuotedCommentThread,
} from "@/lib/comments";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

/**
 * CodeMirror extension that highlights text quoted in comments.
 * Uses Decoration.mark for styling (keeps text editable) and
 * the global CommentTooltipService for hover tooltips and click handling.
 */
export function commentQuotes(
  threads: QuotedCommentThread[],
  onSelect: (commentId: number) => void,
  selectedId: number | null = null,
  showInline: boolean = true,
): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private dom: HTMLElement;

      constructor(view: EditorView) {
        this.dom = view.dom;
        commentTooltipService.attach(this.dom, { onSelect });
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      destroy() {
        commentTooltipService.detach(this.dom);
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();

        if (!threads.length || (!showInline && selectedId === null)) {
          return builder.finish();
        }

        const threadsToShow = showInline
          ? threads
          : threads.filter((t) => t.comment.id === selectedId);

        const matches = findQuoteMatches(threadsToShow, view.state.doc.toString());

        for (const { thread, start, end } of matches) {
          builder.add(
            start,
            end,
            Decoration.mark({
              class: getHighlightClasses(selectedId === thread.comment.id),
              attributes: {
                [COMMENT_ID_ATTR]: thread.comment.id.toString(),
              },
            }),
          );
        }

        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}
