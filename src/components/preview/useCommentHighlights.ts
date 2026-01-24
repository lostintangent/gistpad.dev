import { RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { commentTooltipService } from "@/components/comments/CommentTooltipService";
import {
  COMMENT_ID_ATTR,
  findDOMQuoteMatches,
  getHighlightClasses,
  HIGHLIGHT_CLASS,
  HIGHLIGHT_SELECTED_CLASSES,
  QuotedCommentThread,
} from "@/lib/comments";

interface UseCommentHighlightsOptions {
  /** Comment threads to highlight */
  threads: QuotedCommentThread[];
  /** Currently selected comment ID */
  selectedId: number | null;
  /** Whether to show inline highlights */
  showInline: boolean;
  /** Callback when a highlight is clicked */
  onSelect?: (commentId: number) => void;
}

/** Selector for highlight elements */
const HIGHLIGHT_SELECTOR = `.${HIGHLIGHT_CLASS}`;

/** Compute a stable ID string from threads for comparison */
function getThreadIds(threads: QuotedCommentThread[]): string {
  return threads
    .map((t) => t.comment.id)
    .sort()
    .join(",");
}

/**
 * Hook that manages inline comment highlights in a container element.
 *
 * Handles:
 * - Finding and highlighting quoted text from comment threads
 * - Updating selection styling when selectedId changes
 * - Scrolling to selected highlights
 * - Tooltip service attachment for hover/click
 * - Rebuilding highlights when React wipes DOM modifications
 */
export function useCommentHighlights(
  containerRef: RefObject<HTMLElement | null>,
  options: UseCommentHighlightsOptions,
) {
  const { threads, selectedId, showInline, onSelect } = options;

  // Keep refs to avoid recreating callbacks
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Track the last applied thread IDs to avoid unnecessary rebuilds
  const appliedThreadIdsRef = useRef<string>("");

  // Attach tooltip service for hover and click-to-select
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    commentTooltipService.attach(container, {
      onSelect: (commentId) => onSelectRef.current?.(commentId),
    });

    return () => commentTooltipService.detach(container);
  }, []);

  // Build comment quote highlights after every render, but only if needed.
  // Runs on every render (no deps) to detect when React wipes our DOM modifications.
  // Uses useLayoutEffect to apply changes synchronously before paint.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!showInline) {
      cleanup(container);
      appliedThreadIdsRef.current = "";
      return;
    }

    // Only rebuild if threads changed or highlights are missing
    if (needsRebuild(container, threadsRef.current, appliedThreadIdsRef.current)) {
      cleanup(container);
      apply(container, threadsRef.current);
      appliedThreadIdsRef.current = getThreadIds(threadsRef.current);
    }
  });

  // Update selection styling after every render.
  // Runs without deps because the parent component may re-render (e.g., when
  // threads update) without selectedId changing, and we need to ensure the
  // selection is re-applied if it was lost.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showInline || selectedId === null) return;

    applySelection(container, selectedId);
  });
}

// ============================================================================
// Helper functions (defined outside hook to avoid recreation on each render)
// ============================================================================

/** Clean up existing highlights, restoring plain text */
function cleanup(container: HTMLElement) {
  container.querySelectorAll(HIGHLIGHT_SELECTOR).forEach((highlight) => {
    if (highlight.parentNode) {
      const textNode = document.createTextNode(highlight.textContent || "");
      highlight.parentNode.replaceChild(textNode, highlight);
      textNode.parentNode?.normalize();
    }
  });
}

/** Apply comment quote highlights as plain DOM spans */
function apply(container: HTMLElement, threads: QuotedCommentThread[]) {
  if (threads.length === 0) return;

  const matches = findDOMQuoteMatches(threads, container);

  for (const { thread, node, startOffset, endOffset } of matches) {
    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);

    const highlight = document.createElement("span");
    highlight.className = getHighlightClasses(false);
    highlight.setAttribute(COMMENT_ID_ATTR, thread.comment.id.toString());
    highlight.textContent = thread.quotedText;

    range.deleteContents();
    range.insertNode(highlight);
  }
}

/** Check if highlights need to be rebuilt */
function needsRebuild(
  container: HTMLElement,
  threads: QuotedCommentThread[],
  appliedIds: string,
): boolean {
  // Threads changed?
  if (getThreadIds(threads) !== appliedIds) return true;

  // Highlights missing from DOM? (React may have replaced them)
  const existingCount = container.querySelectorAll(HIGHLIGHT_SELECTOR).length;
  return existingCount === 0 && threads.length > 0;
}

/** Apply selection styling to the highlight with the given ID */
function applySelection(container: HTMLElement, selectedId: number) {
  // Find the element to select
  const toSelect = container.querySelector(
    `${HIGHLIGHT_SELECTOR}[${COMMENT_ID_ATTR}="${selectedId}"]`,
  );
  if (!toSelect) return;

  // Already selected? Nothing to do
  if (toSelect.classList.contains(HIGHLIGHT_SELECTED_CLASSES.split(" ")[0])) return;

  // Deselect any currently selected highlight
  const currentlySelected = container.querySelector(
    `${HIGHLIGHT_SELECTOR}.${HIGHLIGHT_SELECTED_CLASSES.split(" ")[0]}`,
  );
  if (currentlySelected) {
    (currentlySelected as HTMLElement).className = getHighlightClasses(false);
  }

  // Select the new one
  (toSelect as HTMLElement).className = getHighlightClasses(true);
  toSelect.scrollIntoView({ behavior: "smooth", block: "center" });
}
