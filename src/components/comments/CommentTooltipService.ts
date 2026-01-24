import { createElement } from "react";
import { createRoot, Root } from "react-dom/client";
import { CommentTooltip } from "./CommentTooltip";
import { COMMENT_ID_ATTR, HIGHLIGHT_CLASS, QuotedCommentThread } from "@/lib/comments";

/** Selector for Radix popover content (used to detect tooltip hover) */
const TOOLTIP_SELECTOR = "[data-radix-popper-content-wrapper]";

/** Options for attaching the tooltip service to a container */
export interface AttachOptions {
  /** Callback when a comment highlight is clicked */
  onSelect?: (commentId: number) => void;
}

/**
 * Global service for showing comment tooltips on hover and handling click-to-select.
 *
 * Usage:
 * 1. Parent component registers threads: `commentTooltipService.setThreads(threads)`
 * 2. Consumers attach their containers: `commentTooltipService.attach(container, { onSelect })`
 * 3. Consumers detach when unmounting: `commentTooltipService.detach(container)`
 *
 * The service handles all mouse events and tooltip positioning automatically.
 * Any element with class "comment-quote-highlight" and data-comment-id attribute
 * will show a tooltip on hover and trigger onSelect on click.
 */
class CommentTooltipService {
  private root: Root | null = null;
  private container: HTMLDivElement | null = null;
  private threads: Map<number, QuotedCommentThread> = new Map();
  private currentAnchor: HTMLElement | null = null;
  private attachedContainers: Map<HTMLElement, AttachOptions> = new Map();

  constructor() {
    // Lazily create the portal container
    this.ensurePortal();
  }

  private ensurePortal() {
    if (this.container) return;

    this.container = document.createElement("div");
    this.container.id = "comment-tooltip-portal";
    document.body.appendChild(this.container);
    this.root = createRoot(this.container);
  }

  /** Update the available threads for tooltip lookup */
  setThreads(threads: QuotedCommentThread[]) {
    this.threads = new Map(threads.map((t) => [t.comment.id, t]));
  }

  /** Show tooltip for a thread anchored to an element */
  show(thread: QuotedCommentThread, anchor: HTMLElement) {
    this.ensurePortal();
    if (!this.root) return;

    // Don't re-render if already showing for this anchor
    if (this.currentAnchor === anchor) return;
    this.currentAnchor = anchor;

    this.root.render(
      createElement(CommentTooltip, {
        thread,
        anchorElement: anchor,
        onClose: () => this.hide(),
      }),
    );
  }

  /** Hide the current tooltip */
  hide() {
    if (!this.root) return;
    this.root.render(null);
    this.currentAnchor = null;
  }

  /**
   * Attach event listeners to a container element.
   * The container will respond to hover and click events on comment highlights.
   */
  attach(container: HTMLElement, options: AttachOptions = {}) {
    if (this.attachedContainers.has(container)) return;

    container.addEventListener("mouseover", this.handleMouseOver);
    container.addEventListener("mouseout", this.handleMouseOut);
    container.addEventListener("click", this.handleClick);
    this.attachedContainers.set(container, options);

    // Add document listener for hiding when mouse leaves tooltip
    if (this.attachedContainers.size === 1) {
      document.addEventListener("mouseover", this.handleDocumentMouseOver);
    }
  }

  /** Detach event listeners from a container element */
  detach(container: HTMLElement) {
    container.removeEventListener("mouseover", this.handleMouseOver);
    container.removeEventListener("mouseout", this.handleMouseOut);
    container.removeEventListener("click", this.handleClick);
    this.attachedContainers.delete(container);

    // Remove document listener if no containers attached
    if (this.attachedContainers.size === 0) {
      document.removeEventListener("mouseover", this.handleDocumentMouseOver);
      this.hide();
    }
  }

  private handleMouseOver = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains(HIGHLIGHT_CLASS)) return;

    // Don't re-render if already showing for this anchor
    if (this.currentAnchor === target) return;

    const commentId = target.getAttribute(COMMENT_ID_ATTR);
    if (!commentId) return;

    const thread = this.threads.get(Number(commentId));
    if (thread) {
      this.show(thread, target);
    }
  };

  private handleMouseOut = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains(HIGHLIGHT_CLASS)) return;

    const related = e.relatedTarget as HTMLElement | null;

    // Don't hide if moving to the tooltip itself
    if (related?.closest(TOOLTIP_SELECTOR)) return;

    // Don't hide if moving to another highlight
    if (related?.classList.contains(HIGHLIGHT_CLASS)) return;

    this.hide();
  };

  private handleDocumentMouseOver = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // If we're over a highlight or the tooltip, do nothing
    if (target.classList.contains(HIGHLIGHT_CLASS)) return;
    if (target.closest(TOOLTIP_SELECTOR)) return;

    // Otherwise, if tooltip is showing, hide it
    if (this.currentAnchor) {
      this.hide();
    }
  };

  private handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains(HIGHLIGHT_CLASS)) return;

    const commentId = target.getAttribute(COMMENT_ID_ATTR);
    if (!commentId) return;

    // Find the container this event came from and call its onSelect
    const container = e.currentTarget as HTMLElement;
    const options = this.attachedContainers.get(container);
    options?.onSelect?.(Number(commentId));
  };
}

/** Global singleton instance */
export const commentTooltipService = new CommentTooltipService();
