import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { useIsMobile } from "@/hooks/useMobile";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock, TrendingUp, User } from "lucide-react";
import { useState } from "react";
import { Comment } from "../types";

const COMMENT_INDENT_PX = 12;
const MOBILE_COLLAPSE_DEPTH = 3;
const DESKTOP_COLLAPSE_DEPTH = 4;

function getRelativeTime(date: Date): string {
  // Ensure we have a valid Date object
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    return "Unknown";
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  }

  const distance = formatDistanceToNowStrict(dateObj, {
    addSuffix: false,
  });

  // Convert the verbose format to short format
  const shortFormat = distance
    .replace(/\s+seconds?/, "s")
    .replace(/\s+minutes?/, "m")
    .replace(/\s+hours?/, "h")
    .replace(/\s+days?/, "d")
    .replace(/\s+months?/, "mo")
    .replace(/\s+years?/, "y");

  return shortFormat;
}

function getInitialCollapsedState(
  depth: number,
  isInitiallyCollapsed: boolean,
  isMobile: boolean
): boolean {
  if (depth === 0) return isInitiallyCollapsed;
  return depth >= (isMobile ? MOBILE_COLLAPSE_DEPTH : DESKTOP_COLLAPSE_DEPTH);
}

interface CommentItemProps {
  comment: Comment;
  depth?: number;
  isInitiallyCollapsed?: boolean;
  onToggleCollapse?: (id: string, collapsed: boolean) => void;
}

export function CommentItem({
  comment,
  depth = 0,
  isInitiallyCollapsed = false,
  onToggleCollapse,
}: CommentItemProps) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(
    getInitialCollapsedState(depth, isInitiallyCollapsed, isMobile)
  );

  const handleToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);

    // Only persist state for top-level comments
    if (depth === 0 && onToggleCollapse) {
      onToggleCollapse(comment.id, newCollapsed);
    }
  };

  const hasReplies = comment.replies && comment.replies.length > 0;
  const replyCount = comment.replies?.length || 0;

  return (
    <div
      className={depth > 0 ? "pl-3" : ""}
      style={{ marginLeft: `${depth * COMMENT_INDENT_PX}px` }}
    >
      {/* Comment metadata */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UserLink user={comment.user} />
          <DateLink date={comment.date} url={comment.url} />
          {comment.points !== undefined && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {comment.points}
            </span>
          )}
          {(hasReplies || depth === 0 || isCollapsed) && (
            <CollapseButton
              isCollapsed={isCollapsed}
              replyCount={replyCount}
              onClick={handleToggle}
            />
          )}
        </div>
      </div>

      {/* Comment body */}
      {!isCollapsed && comment.text && (
        <div className="not-last:mb-3 break-words overflow-wrap-anywhere">
          <MarkdownPreview shouldInvert>{comment.text}</MarkdownPreview>
        </div>
      )}

      {/* Nested replies */}
      {!isCollapsed && hasReplies && (
        <div className="space-y-3">
          {comment.replies!.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserLink({
  user,
}: {
  user: { name: string; url: string; avatar?: string };
}) {
  return (
    <a
      href={user.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 hover:text-foreground transition-colors hover:underline"
    >
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <User className="h-3 w-3" />
      )}
      <span className="font-medium">{user.name}</span>
    </a>
  );
}

function DateLink({ date, url }: { date: Date; url?: string }) {
  const timeDisplay = (
    <>
      <Clock className="h-3 w-3" />
      {getRelativeTime(date)}
    </>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:text-foreground transition-colors hover:underline"
      >
        {timeDisplay}
      </a>
    );
  }

  return <span className="flex items-center gap-1">{timeDisplay}</span>;
}

function CollapseButton({
  isCollapsed,
  replyCount,
  onClick,
}: {
  isCollapsed: boolean;
  replyCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      <span className="font-mono text-xs">{isCollapsed ? "[+]" : "[-]"}</span>
      {replyCount > 0 && (
        <span>
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </span>
      )}
    </button>
  );
}
