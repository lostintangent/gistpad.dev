import { GistComment } from "@/lib/github";

// Reply marker format: > [comment:<id>]
const REPLY_MARKER_REGEX = /^>\s*\[comment:(\d+)\]\s*$/;

// Minimum length for quoted text to be highlightable
const MIN_QUOTE_LENGTH = 3;

// ============================================================================
// Highlight constants - shared between CodeMirror, MarkdownPreview, and tooltip service
// ============================================================================

/** CSS class used to identify comment highlight elements */
export const HIGHLIGHT_CLASS = "comment-quote-highlight";

/** Data attribute storing the comment ID on highlight elements */
export const COMMENT_ID_ATTR = "data-comment-id";

/** Base classes for all comment quote highlights */
const HIGHLIGHT_BASE_CLASSES = `${HIGHLIGHT_CLASS} rounded px-0.5 cursor-pointer hover:underline`;

/** Classes for unselected (default) highlights */
const HIGHLIGHT_DEFAULT_CLASSES = "bg-green-400 text-black hover:bg-green-500";

/** Classes for selected highlights */
export const HIGHLIGHT_SELECTED_CLASSES = "bg-primary text-primary-foreground";

/** Get the full class string for a highlight element */
export function getHighlightClasses(isSelected: boolean): string {
  return `${HIGHLIGHT_BASE_CLASSES} ${isSelected ? HIGHLIGHT_SELECTED_CLASSES : HIGHLIGHT_DEFAULT_CLASSES}`;
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

/** Extract and trim the first line of a comment body */
function getFirstLine(body: string): string {
  return body.split("\n")[0].trim();
}

/** Check if a line is a blockquote (starts with >) */
function isBlockquote(line: string): boolean {
  return line.startsWith(">");
}

/** Check if a line is a reply marker (> [comment:123]) */
function isReplyMarker(line: string): boolean {
  return REPLY_MARKER_REGEX.test(line);
}

/**
 * Parse the parent comment ID from a comment body, if it's a reply.
 */
function getParentCommentId(body: string): number | null {
  const firstLine = getFirstLine(body);
  const match = firstLine.match(REPLY_MARKER_REGEX);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if a comment quotes actual document text (not a reply marker).
 * Only these comments should create inline highlights.
 */
function hasTextQuote(comment: GistComment): boolean {
  const firstLine = getFirstLine(comment.body);
  return isBlockquote(firstLine) && !isReplyMarker(firstLine);
}

/**
 * Extract the quoted text from a comment that quotes document text.
 */
function getQuotedText(comment: GistComment): string | null {
  if (!hasTextQuote(comment)) return null;
  const firstLine = getFirstLine(comment.body);
  // Remove the leading ">" and trim
  return firstLine.substring(1).trim();
}

/**
 * Get the comment body suitable for display in tooltips.
 * Strips the first line if it's a blockquote (text quote or reply marker).
 * Use this when the quoted text is already shown elsewhere (e.g., highlighted inline).
 */
export function getDisplayBody(body: string): string {
  const firstLine = getFirstLine(body);

  if (isBlockquote(firstLine)) {
    const lines = body.split("\n");
    return lines.slice(1).join("\n").replace(/^\n+/, "").trim();
  }
  return body;
}

/**
 * Get the comment body suitable for display in the sidebar.
 * Only strips reply markers, preserving text quotes so users see what the comment references.
 */
export function getSidebarDisplayBody(body: string): string {
  const firstLine = getFirstLine(body);

  // Only strip reply markers, not text quotes
  if (isReplyMarker(firstLine)) {
    const lines = body.split("\n");
    return lines.slice(1).join("\n").replace(/^\n+/, "").trim();
  }
  return body;
}

/**
 * Get the hidden prefix from a comment body (reply marker or text quote).
 * Returns empty string if no prefix exists.
 */
export function getCommentPrefix(body: string): string {
  const firstLine = getFirstLine(body);

  if (isBlockquote(firstLine)) {
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

/**
 * Filter threads to only those where the top-level comment quotes document text.
 * Pre-extracts the quoted text for efficient rendering.
 */
export function getQuotedCommentThreads(threads: CommentThread[]): QuotedCommentThread[] {
  return threads
    .filter((thread) => hasTextQuote(thread.comment))
    .map((thread) => ({
      ...thread,
      quotedText: getQuotedText(thread.comment)!,
    }));
}

/**
 * Find the top-level quoted thread that contains a comment (by ID).
 * Used to highlight the correct text when a reply is selected.
 */
export function findQuotedThreadForComment(
  quotedThreads: QuotedCommentThread[],
  commentId: number,
): QuotedCommentThread | null {
  const containsComment = (thread: CommentThread, id: number): boolean => {
    if (thread.comment.id === id) return true;
    return thread.replies.some((reply) => containsComment(reply, id));
  };

  return quotedThreads.find((thread) => containsComment(thread, commentId)) ?? null;
}

/**
 * Find a comment by ID within a thread tree.
 */
export function findCommentInThreads(
  threads: CommentThread[],
  commentId: number,
): GistComment | null {
  for (const thread of threads) {
    if (thread.comment.id === commentId) {
      return thread.comment;
    }
    const found = findCommentInThreads(thread.replies, commentId);
    if (found) return found;
  }
  return null;
}

// ============================================================================
// Text matching utilities for inline comment highlighting
// ============================================================================

/** Creates a word-boundary regex for the given text */
function createQuoteRegex(quotedText: string): RegExp {
  const escaped = quotedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "g");
}

/** Match result for string-based search (CodeMirror) */
export interface QuoteMatch {
  thread: QuotedCommentThread;
  start: number;
  end: number;
}

/**
 * Find unique matches for quoted text in a plain text string.
 * Used by CodeMirror where we have direct access to the document text.
 * Only returns matches where the quoted text appears exactly once.
 */
export function findQuoteMatches(threads: QuotedCommentThread[], text: string): QuoteMatch[] {
  const matches: QuoteMatch[] = [];

  for (const thread of threads) {
    const { quotedText } = thread;
    if (quotedText.length < MIN_QUOTE_LENGTH) continue;

    const regex = createQuoteRegex(quotedText);
    let matchCount = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      matchCount++;
      lastIndex = match.index;
    }

    if (matchCount === 1) {
      matches.push({ thread, start: lastIndex, end: lastIndex + quotedText.length });
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

/** Match result for DOM-based search (MarkdownPreview) */
export interface DOMQuoteMatch {
  thread: QuotedCommentThread;
  node: Text;
  startOffset: number;
  endOffset: number;
}

/**
 * Find unique matches for quoted text within DOM text nodes.
 * Used by MarkdownPreview where we need to insert React components into rendered HTML.
 * Only returns matches where the quoted text appears exactly once in the container.
 */
export function findDOMQuoteMatches(
  threads: QuotedCommentThread[],
  container: HTMLElement,
): DOMQuoteMatch[] {
  const matches: DOMQuoteMatch[] = [];

  for (const thread of threads) {
    const { quotedText } = thread;
    if (quotedText.length < MIN_QUOTE_LENGTH) continue;

    const regex = createQuoteRegex(quotedText);
    const nodeMatches: DOMQuoteMatch[] = [];

    // Walk all text nodes in the container
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(textNode.textContent || "")) !== null) {
        nodeMatches.push({
          thread,
          node: textNode,
          startOffset: match.index,
          endOffset: match.index + quotedText.length,
        });
      }
    }

    // Only include if exactly one match across the entire container
    if (nodeMatches.length === 1) {
      matches.push(nodeMatches[0]);
    }
  }

  return matches;
}
