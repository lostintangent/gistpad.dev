import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommentThread, getDisplayBody } from "@/lib/comments";
import { GistComment } from "@/lib/github";
import { formatDistanceToNow } from "date-fns";

interface CommentTooltipProps {
  thread: CommentThread;
  anchorElement: HTMLElement;
  onClose: () => void;
}

/**
 * A tooltip that displays a comment thread anchored to a DOM element.
 * Uses Radix Popover with portal to ensure it renders above all content.
 *
 * This component handles the invisible anchor positioning internally -
 * consumers just need to provide the element to anchor to.
 */
export function CommentTooltip({ thread, anchorElement, onClose }: CommentTooltipProps) {
  const rect = anchorElement.getBoundingClientRect();

  return (
    <Popover open={true} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>
        {/* Invisible anchor positioned over the target element */}
        <span
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            pointerEvents: "none",
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <CommentTooltipContent thread={thread} />
      </PopoverContent>
    </Popover>
  );
}

/** The content of a comment tooltip */
function CommentTooltipContent({ thread }: { thread: CommentThread }) {
  const { comment, replies } = thread;

  return (
    <div className="min-w-[300px] max-w-[500px] max-h-[400px] overflow-y-auto p-4">
      {/* Main comment */}
      <CommentHeader comment={comment} />
      <CommentBody comment={comment} />

      {/* Replies (with indentation) */}
      {replies.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {replies.map((reply) => (
            <ReplyThread key={reply.comment.id} thread={reply} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Recursively render replies with indentation */
function ReplyThread({ thread, depth }: { thread: CommentThread; depth: number }) {
  return (
    <>
      <div style={{ marginLeft: `${depth * 12}px` }}>
        <CommentHeader comment={thread.comment} />
        <CommentBody comment={thread.comment} />
      </div>
      {thread.replies.map((reply) => (
        <ReplyThread key={reply.comment.id} thread={reply} depth={depth + 1} />
      ))}
    </>
  );
}

/** Comment author header with avatar, name, and timestamp */
function CommentHeader({ comment }: { comment: GistComment }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Avatar className="h-6 w-6">
        <AvatarImage src={comment.user?.avatar_url} />
        <AvatarFallback>{comment.user?.login?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{comment.user?.login || "Anonymous"}</span>
      <span className="text-xs text-muted-foreground">
        {formatDistanceToNow(comment.created_at, { addSuffix: true })}
      </span>
    </div>
  );
}

/** Comment body with markdown rendering */
function CommentBody({ comment }: { comment: GistComment }) {
  return (
    <div>
      <MarkdownPreview enableBlockquoteCopying={false}>
        {getDisplayBody(comment.body)}
      </MarkdownPreview>
    </div>
  );
}
