import {
  COMMENT_ID_ATTR,
  findQuoteMatches,
  getHighlightClasses,
  type CommentHighlights,
} from "@/features/comments/threads";
import { Decoration } from "@codemirror/view";
import { decorationsPlugin } from "./plugin";

/** Highlights the text that comments quote. Hovering and clicking highlights is handled by `CommentTooltips`. */
export const commentHighlights = ({ threads, selectedId }: CommentHighlights) =>
  decorationsPlugin((view) =>
    Decoration.set(
      findQuoteMatches(threads, [view.state.doc.toString()]).map(({ thread, start, end }) =>
        Decoration.mark({
          class: getHighlightClasses(selectedId === thread.comment.id),
          attributes: { [COMMENT_ID_ATTR]: String(thread.comment.id) },
        }).range(start, end),
      ),
      true,
    ),
  );
