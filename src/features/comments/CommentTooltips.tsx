import { timeAgo } from "@/shared/dates";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import type { GistComment } from "@/shared/github";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Popover, PopoverContent } from "@/shared/ui/popover";
import { useEffect, useEffectEvent, useState } from "react";
import {
  COMMENT_ID_ATTR,
  getDisplayBody,
  HIGHLIGHT_CLASS,
  type CommentThread,
  type QuotedCommentThread,
} from "./threads";

const HIGHLIGHT_SELECTOR = `.${HIGHLIGHT_CLASS}`;

/** How long the tooltip stays open after the pointer leaves its highlight (e.g. to move onto it). */
const HIDE_DELAY = 150;

/**
 * Shows a comment's thread while hovering over its highlight (in the editor or the preview), and
 * selects the comment when its highlight is clicked. Highlights are found by their class, since
 * the editor's highlights are rendered by CodeMirror (rather than React).
 */
export function CommentTooltips({
  threads,
  onSelect,
}: {
  threads: QuotedCommentThread[];
  onSelect?: (commentId: number) => void;
}) {
  const [highlight, setHighlight] = useState<HTMLElement | null>(null);
  const select = useEffectEvent((commentId: number) => onSelect?.(commentId));

  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout> | undefined;

    const onMouseOver = (event: MouseEvent) => {
      const target = event.target as Element;
      clearTimeout(hideTimeout);
      if (target.closest("[data-comment-tooltip]")) return;

      const highlight = target.closest<HTMLElement>(HIGHLIGHT_SELECTOR);
      if (highlight) setHighlight(highlight);
      else hideTimeout = setTimeout(() => setHighlight(null), HIDE_DELAY);
    };

    const onClick = (event: MouseEvent) => {
      const commentId = (event.target as Element)
        .closest(HIGHLIGHT_SELECTOR)
        ?.getAttribute(COMMENT_ID_ATTR);
      if (commentId) select(Number(commentId));
    };

    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("click", onClick);
    return () => {
      clearTimeout(hideTimeout);
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const commentId = Number(highlight?.getAttribute(COMMENT_ID_ATTR));
  const thread = threads.find(({ comment }) => comment.id === commentId);
  if (!highlight || !thread) return null;

  return (
    <Popover
      open
      // The tooltip closes when the pointer leaves it (or its highlight), rather than on outside clicks
      onOpenChange={(open, { reason }) => !open && reason !== "outside-press" && setHighlight(null)}
    >
      <PopoverContent
        anchor={highlight}
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto p-0"
        // Hovering over a highlight shouldn't take focus away from the editor
        initialFocus={false}
        finalFocus={false}
        data-comment-tooltip=""
      >
        <div className="min-w-[300px] max-w-[500px] max-h-[400px] overflow-y-auto p-4">
          <Comment comment={thread.comment} />
          {thread.replies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              {thread.replies.map((reply) => (
                <Replies key={reply.comment.id} thread={reply} depth={0} />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Replies({ thread, depth }: { thread: CommentThread; depth: number }) {
  return (
    <>
      <div style={{ marginLeft: depth * 12 }}>
        <Comment comment={thread.comment} />
      </div>
      {thread.replies.map((reply) => (
        <Replies key={reply.comment.id} thread={reply} depth={depth + 1} />
      ))}
    </>
  );
}

function Comment({ comment }: { comment: GistComment }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Avatar className="h-6 w-6">
          <AvatarImage src={comment.user?.avatar_url} />
          <AvatarFallback>{comment.user?.login?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{comment.user?.login || "Anonymous"}</span>
        <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
      </div>
      <MarkdownPreview enableBlockquoteCopying={false}>
        {getDisplayBody(comment.body)}
      </MarkdownPreview>
    </>
  );
}
