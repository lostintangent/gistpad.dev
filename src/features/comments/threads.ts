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
    isSelected
      ? "bg-primary text-primary-foreground"
      : "bg-accent/50 text-foreground hover:bg-accent"
  }`;
}

export interface CommentThread {
  comment: GistComment;
  replies: CommentThread[];
}

/** A thread whose top-level comment quotes the document (so it's highlighted in the editor/preview). */
export interface QuotedCommentThread extends CommentThread {
  quotedText: string;
}

// Comments that quote the document (or reply to another comment) start with a blockquote line,
// e.g. `> quoted text` or `> [comment:123]`.

const getFirstLine = (body: string) => body.split("\n")[0].trim();
const isReplyMarker = (line: string) => REPLY_MARKER_REGEX.test(line);
const stripFirstLine = (body: string) => body.split("\n").slice(1).join("\n").trim();

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
 * A comment's hidden prefix (i.e. its quote or reply marker), which is its first line and any blank
 * lines after it (or an empty string, if it doesn't have one).
 */
export function getCommentPrefix(body: string) {
  return getFirstLine(body).startsWith(">")
    ? body.match(/^[^\n]*(?:\n[^\S\n]*(?=\n|$))*\n?/)![0]
    : "";
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
    const parentId = getFirstLine(thread.comment.body).match(REPLY_MARKER_REGEX)?.[1];
    (threads.get(Number(parentId))?.replies ?? topLevel).push(thread);
  }

  return topLevel;
}

export const createReplyMarker = (parentCommentId: number) => `> [comment:${parentCommentId}]\n\n`;

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
