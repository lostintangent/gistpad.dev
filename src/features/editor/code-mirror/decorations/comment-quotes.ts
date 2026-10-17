import {
  COMMENT_ID_ATTR,
  findQuoteMatches,
  getHighlightClasses,
  type QuotedCommentThread,
} from "@/features/comments/threads";
import { Decoration } from "@codemirror/view";
import { decorationsPlugin } from "./plugin";

/**
 * Highlights the text that comments quote (or only the selected comment's quote, when inline
 * comments are hidden). Hovering and clicking highlights is handled by `CommentTooltips`.
 */
export function commentQuotes(
  threads: QuotedCommentThread[],
  selectedId: number | null,
  showInline: boolean,
) {
  const visibleThreads = showInline
    ? threads
    : threads.filter(({ comment }) => comment.id === selectedId);

  return decorationsPlugin((view) =>
    Decoration.set(
      findQuoteMatches(visibleThreads, [view.state.doc.toString()]).map(({ thread, start, end }) =>
        Decoration.mark({
          class: getHighlightClasses(selectedId === thread.comment.id),
          attributes: { [COMMENT_ID_ATTR]: String(thread.comment.id) },
        }).range(start, end),
      ),
      true,
    ),
  );
}
