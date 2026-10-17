import type { GistComment } from "@/shared/github";

// Reply marker format: > [comment:<id>]
const REPLY_MARKER_REGEX = /^>\s*\[comment:(\d+)\]\s*$/;

// Minimum length for quoted text to be highlightable
const MIN_QUOTE_LENGTH = 3;

// Highlights of quoted text (in the editor and preview), which are identified by their class and
// comment ID attribute (so that their tooltips and clicks can be handled in one place).

export const HIGHLIGHT_CLASS = "comment-quote-highlight";
export const COMMENT_ID_ATTR = "data-comment-id";

export function getHighlightClasses(isSelected: boolean) {
  return `${HIGHLIGHT_CLASS} rounded px-0.5 cursor-pointer hover:underline ${
    isSelected ? "bg-primary text-primary-foreground" : "bg-green-400 text-black hover:bg-green-500"
  }`;
}

export interface CommentThread {
  comment: GistComment;
  replies: CommentThread[];
}

/**
 * A comment thread where the top-level comment quotes document text.
 * Used for inline highlighting in the editor and preview.
 */
export interface QuotedCommentThread extends CommentThread {
  /** The text quoted from the document */
  quotedText: string;
}

// Comments that quote the document (or reply to another comment) start with a blockquote line,
// e.g. `> quoted text` or `> [comment:123]`.

const getFirstLine = (body: string) => body.split("\n")[0].trim();
const isReplyMarker = (line: string) => REPLY_MARKER_REGEX.test(line);
const stripFirstLine = (body: string) => body.split("\n").slice(1).join("\n").trim();

function getParentCommentId(body: string) {
  const match = getFirstLine(body).match(REPLY_MARKER_REGEX);
  return match ? Number(match[1]) : null;
}

/** The document text that a comment quotes (as opposed to a reply marker), if any. */
function getQuotedText(comment: GistComment) {
  const firstLine = getFirstLine(comment.body);
  return firstLine.startsWith(">") && !isReplyMarker(firstLine) ? firstLine.slice(1).trim() : null;
}

/** A comment's body, without its quote or reply marker (e.g. where the quote is highlighted already). */
export function getDisplayBody(body: string) {
  return getFirstLine(body).startsWith(">") ? stripFirstLine(body) : body;
}

/** A comment's body, without its reply marker (but keeping its quote, which provides context). */
export function getSidebarDisplayBody(body: string) {
  return isReplyMarker(getFirstLine(body)) ? stripFirstLine(body) : body;
}

/**
 * Get the hidden prefix from a comment body (reply marker or text quote).
 * Returns empty string if no prefix exists.
 */
export function getCommentPrefix(body: string): string {
  const firstLine = getFirstLine(body);

  if (firstLine.startsWith(">")) {
    // Return the first line plus any following blank lines
    const lines = body.split("\n");
    let prefixEnd = 1;
    while (prefixEnd < lines.length && lines[prefixEnd].trim() === "") {
      prefixEnd++;
    }
    return lines.slice(0, prefixEnd).join("\n") + (prefixEnd < lines.length ? "\n" : "");
  }
  return "";
}

/**
 * Build threaded comment structure from a flat comment list.
 * All comments (top-level and replies) are sorted newest first.
 */
export function buildCommentThreads(comments: GistComment[]): CommentThread[] {
  const threadById = new Map<number, CommentThread>();
  const topLevel: CommentThread[] = [];

  // Create thread objects for all comments
  for (const comment of comments) {
    threadById.set(comment.id, { comment, replies: [] });
  }

  // Build parent-child relationships
  for (const comment of comments) {
    const thread = threadById.get(comment.id)!;
    const parentId = getParentCommentId(comment.body);

    if (parentId && threadById.has(parentId)) {
      threadById.get(parentId)!.replies.push(thread);
    } else {
      // Top-level comment (or orphaned reply treated as top-level)
      topLevel.push(thread);
    }
  }

  // Sort by date (newest first)
  const byDateDescending = (a: CommentThread, b: CommentThread) =>
    new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime();

  // Sort top-level (newest first)
  topLevel.sort(byDateDescending);

  // Recursively sort all replies (newest first)
  const sortReplies = (thread: CommentThread) => {
    thread.replies.sort(byDateDescending);
    thread.replies.forEach(sortReplies);
  };
  topLevel.forEach(sortReplies);

  return topLevel;
}

/**
 * Create the reply marker prefix for a new reply.
 */
export function createReplyMarker(parentCommentId: number): string {
  return `> [comment:${parentCommentId}]\n\n`;
}

/** The threads whose top-level comment quotes the document. */
export function getQuotedCommentThreads(threads: CommentThread[]): QuotedCommentThread[] {
  return threads.flatMap((thread) => {
    const quotedText = getQuotedText(thread.comment);
    return quotedText ? [{ ...thread, quotedText }] : [];
  });
}

/**
 * Finds the quote of each thread, in a document that's split into text segments (e.g. the text nodes
 * of rendered markdown). Quotes are only matched when they appear exactly once (as whole words).
 */
export function findQuoteMatches(threads: QuotedCommentThread[], segments: string[]) {
  return threads.flatMap((thread) => {
    if (thread.quotedText.length < MIN_QUOTE_LENGTH) return [];

    const escaped = thread.quotedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = segments.flatMap((text, segment) =>
      [...text.matchAll(pattern)].map(({ index }) => ({
        thread,
        segment,
        start: index,
        end: index + thread.quotedText.length,
      })),
    );

    return matches.length === 1 ? matches : [];
  });
}
