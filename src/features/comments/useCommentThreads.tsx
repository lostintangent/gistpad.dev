import type { ActiveFile } from "@/features/files/file";
import { useIsViewingRevision } from "@/features/editor/history/revision";
import { usePreferences } from "@/features/account/queries";
import { buildCommentThreads, getQuotedCommentThreads, type CommentHighlights } from "./threads";
import { commentsStore } from "./store";
import { isDailyNote, type GistComment } from "@/shared/github";
import { gistQueries } from "@/features/gists/queries";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";

function toThreads(comments: GistComment[]) {
  const threads = buildCommentThreads(comments);
  return { comments, threads, quotedThreads: getQuotedCommentThreads(threads) };
}

const EMPTY = toThreads([]);

/** The open gist's comments, organized into threads (and the threads that quote its content). */
export function useCommentThreads({ gist, gistId }: Pick<ActiveFile, "gist" | "gistId">) {
  const isEnabled = !!gist && !isDailyNote(gist);
  const { data = EMPTY } = useQuery({
    ...gistQueries.comments(gistId),
    // Gists include their comment count, so there's no need to fetch comments that don't exist.
    enabled: isEnabled && gist.comments > 0,
    select: toThreads,
  });

  return { ...data, isEnabled };
}

/**
 * The comments whose quotes are highlighted in the active file: all of them (when the user shows
 * inline comments), or otherwise, just the selected one's. And since comments quote the file's
 * current content, nothing is highlighted while viewing a past revision.
 */
export function useCommentHighlights(file: ActiveFile): CommentHighlights | undefined {
  const { showInlineComments } = usePreferences();
  const { quotedThreads } = useCommentThreads(file);
  const selectedId = useSelector(commentsStore, (state) => state.selectedCommentId);
  const isViewingRevision = useIsViewingRevision();

  if (isViewingRevision) return undefined;

  return {
    threads: showInlineComments
      ? quotedThreads
      : quotedThreads.filter(({ comment }) => comment.id === selectedId),
    selectedId,
  };
}
