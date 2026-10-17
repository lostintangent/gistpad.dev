import {
  COMMENT_ID_ATTR,
  findQuoteMatches,
  getHighlightClasses,
  type QuotedCommentThread,
} from "@/features/comments/threads";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * Highlights the text that comments quote (or only the selected comment's quote, when inline
 * comments are hidden). Hovering and clicking highlights is handled by `CommentTooltips`.
 */
export function commentQuotes(
  threads: QuotedCommentThread[],
  selectedId: number | null,
  showInline: boolean,
): Extension {
  const visibleThreads = showInline
    ? threads
    : threads.filter(({ comment }) => comment.id === selectedId);

  const buildDecorations = (view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>();
    const matches = findQuoteMatches(visibleThreads, [view.state.doc.toString()]);

    for (const { thread, start, end } of matches.sort((a, b) => a.start - b.start)) {
      builder.add(
        start,
        end,
        Decoration.mark({
          class: getHighlightClasses(selectedId === thread.comment.id),
          attributes: { [COMMENT_ID_ATTR]: String(thread.comment.id) },
        }),
      );
    }

    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = buildDecorations(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
