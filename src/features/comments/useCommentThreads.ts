import type { GistDocument } from "@/features/editor/document";
import { buildCommentThreads, getQuotedCommentThreads } from "./threads";
import { isDailyNote, type GistComment } from "@/shared/github";
import { gistQueries } from "@/features/gists/queries";
import { useQuery } from "@tanstack/react-query";

function toThreads(comments: GistComment[]) {
  const threads = buildCommentThreads(comments);
  return { comments, threads, quotedThreads: getQuotedCommentThreads(threads) };
}

const EMPTY = toThreads([]);

/** The open gist's comments, organized into threads (and the threads that quote its content). */
export function useCommentThreads(doc: Pick<GistDocument, "gist" | "gistId">) {
  const isEnabled = !!doc.gist && !isDailyNote(doc.gist);
  const { data = EMPTY } = useQuery({
    ...gistQueries.comments(doc.gistId ?? ""),
    // Gists include their comment count, so there's no need to fetch comments that don't exist.
    enabled: isEnabled && doc.gist!.comments > 0,
    select: toThreads,
  });

  return { ...data, isEnabled };
}
