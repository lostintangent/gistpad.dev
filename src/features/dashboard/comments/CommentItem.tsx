import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { useIsMobile } from "@/shared/useMediaQuery";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock, User } from "lucide-react";
import { useState } from "react";
import { Comment } from "../types";

const COMMENT_INDENT_PX = 12;
const MOBILE_COLLAPSE_DEPTH = 3;
const DESKTOP_COLLAPSE_DEPTH = 4;

const linkClass = "flex items-center gap-1 hover:text-foreground transition-colors hover:underline";

function getRelativeTime(date: Date): string {
  if (Date.now() - date.getTime() < 60_000) return "Just now";

  // Convert the verbose format to short format (e.g. "5 minutes" to "5m")
  return formatDistanceToNowStrict(date)
    .replace(/\s+seconds?/, "s")
    .replace(/\s+minutes?/, "m")
    .replace(/\s+hours?/, "h")
    .replace(/\s+days?/, "d")
    .replace(/\s+months?/, "mo")
    .replace(/\s+years?/, "y");
}

export function CommentItem({
  comment: { id, user, date, text, url, replies },
  depth = 0,
  isInitiallyCollapsed = false,
  onToggleCollapse,
}: {
  comment: Comment;
  depth?: number;
  isInitiallyCollapsed?: boolean;
  /** Called when a top-level comment is collapsed or expanded (so that it can be remembered). */
  onToggleCollapse?: (id: string, isCollapsed: boolean) => void;
}) {
  const isMobile = useIsMobile();

  // Top-level comments start out as the user left them, and deeply nested replies start out collapsed
  const [isCollapsed, setIsCollapsed] = useState(
    depth === 0
      ? isInitiallyCollapsed
      : depth >= (isMobile ? MOBILE_COLLAPSE_DEPTH : DESKTOP_COLLAPSE_DEPTH),
  );

  return (
    <div
      className={depth > 0 ? "pl-3" : ""}
      style={{ marginLeft: `${depth * COMMENT_INDENT_PX}px` }}
    >
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <a href={user.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <User className="h-3 w-3" />
          <span className="font-medium">{user.name}</span>
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Clock className="h-3 w-3" />
          {getRelativeTime(date)}
        </a>
        {(replies.length > 0 || depth === 0 || isCollapsed) && (
          <button
            onClick={() => {
              setIsCollapsed(!isCollapsed);
              onToggleCollapse?.(id, !isCollapsed);
            }}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span className="font-mono text-xs">{isCollapsed ? "[+]" : "[-]"}</span>
            {replies.length > 0 && (
              <span>
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </span>
            )}
          </button>
        )}
      </div>

      {!isCollapsed && text && (
        <div className="not-last:mb-3 break-words overflow-wrap-anywhere">
          <MarkdownPreview>{text}</MarkdownPreview>
        </div>
      )}

      {!isCollapsed && replies.length > 0 && (
        <div className="space-y-3">
          {replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
