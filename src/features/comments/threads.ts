import type { GistComment } from "@/shared/github";

// Reply marker format: > [comment:<id>]
const REPLY_MARKER_REGEX = /^>\s*\[comment:(\d+)\]\s*$/;

// Minimum length for quoted text to be highlightable
const MIN_QUOTE_LENGTH = 3;

// Selecting text (in the editor or preview) shows a button for commenting on it, once the selection
// is long enough to quote, and the browser has had time to paint it.
export const SELECTION_COMMENT = {
  minLength: 4,
  delay: 300,
  title: "Add comment with selected text",
};

// Highlights of quoted text (in the editor and preview), which are identified by their class and
// comment ID attribute (so that their tooltips and clicks can be handled in one place).

export const HIGHLIGHT_CLASS = "comment-quote-highlight";
export const COMMENT_ID_ATTR = "data-comment-id";

export function getHighlightClasses(isSelected: boolean) {
  return `${HIGHLIGHT_CLASS} rounded px-0.5 cursor-pointer hover:underline ${
    isSelected
      ? "bg-primary text-primary-foreground"
      : "bg-accent/50 text-foreground hover:bg-accent"
  }`;
}

export interface CommentThread {
  comment: GistComment;
  replies: CommentThread[];
}

/** A thread whose top-level comment quotes the file (so it's highlighted in the editor/preview). */
export interface QuotedCommentThread extends CommentThread {
  quote: string;
}

/** The threads whose quotes are highlighted in a file (and the selected comment, if any). */
export interface CommentHighlights {
  threads: QuotedCommentThread[];
  selectedId?: number | null;
}

/**
 * Comments that quote the file (or reply to another comment) start with a blockquote line (e.g.
 * `> quoted text` or `> [comment:123]`). That line, and any blank lines after it, is the comment's
 * prefix, which is hidden when it's displayed or edited (i.e. only its text is).
 */
export function parseCommentBody(body: string): {
  prefix: string;
  /** The document text that the comment quotes. */
  quote?: string;
  /** The ID of the comment that this comment is a reply to. */
  parentId?: number;
  text: string;
} {
  const firstLine = body.split("\n")[0].trim();
  if (!firstLine.startsWith(">")) return { prefix: "", text: body };

  const prefix = body.match(/^[^\n]*(?:\n[^\S\n]*(?=\n|$))*\n?/)![0];
  const text = body.slice(prefix.length).trim();
  const parentId = firstLine.match(REPLY_MARKER_REGEX)?.[1];

  return parentId
    ? { prefix, parentId: Number(parentId), text }
    : { prefix, quote: firstLine.slice(1).trim(), text };
}

/** Organizes comments into threads, where comments (and their replies) are sorted newest first. */
export function buildCommentThreads(comments: GistComment[]) {
  const threads = new Map<number, CommentThread>(
    comments
      .toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((comment) => [comment.id, { comment, replies: [] }]),
  );

  // Replies whose parent doesn't exist (e.g. it was deleted) are treated as top-level comments.
  const topLevel: CommentThread[] = [];
  for (const thread of threads.values()) {
    const { parentId } = parseCommentBody(thread.comment.body);
    const parent = parentId ? threads.get(parentId) : undefined;
    (parent?.replies ?? topLevel).push(thread);
  }

  return topLevel;
}

export const createReplyMarker = (parentCommentId: number) => `> [comment:${parentCommentId}]\n\n`;

/** The threads whose top-level comment quotes the file. */
export function getQuotedCommentThreads(threads: CommentThread[]): QuotedCommentThread[] {
  return threads.flatMap((thread) => {
    const { quote } = parseCommentBody(thread.comment.body);
    return quote ? [{ ...thread, quote }] : [];
  });
}

/**
 * Finds the quote of each thread, in a document that's split into text segments (e.g. the text nodes
 * of rendered markdown). Quotes are only matched when they appear exactly once (as whole words).
 */
export function findQuoteMatches(threads: QuotedCommentThread[], segments: string[]) {
  return threads.flatMap((thread) => {
    if (thread.quote.length < MIN_QUOTE_LENGTH) return [];

    const escaped = thread.quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = segments.flatMap((text, segment) =>
      [...text.matchAll(pattern)].map(({ index }) => ({
        thread,
        segment,
        start: index,
        end: index + thread.quote.length,
      })),
    );

    return matches.length === 1 ? matches : [];
  });
}
