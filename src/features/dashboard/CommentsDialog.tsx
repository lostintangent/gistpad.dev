import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { timeAgo } from "@/shared/dates";
import { persistedAtom } from "@/shared/persistedAtom";
import { ScrollableText } from "@/shared/ScrollableText";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIsMobile } from "@/shared/useMediaQuery";
import { cn } from "cn";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Clock, MessageSquare, RefreshCw, User, X } from "lucide-react";
import { useRef, useState } from "react";

/** A comment on a widget's item (e.g. a Hacker News story), along with its replies. */
export interface Comment {
  id: string;
  user: { name: string; url: string };
  date: Date;
  text?: string;
  url: string;
  replies: Comment[];
}

const COLLAPSED_MAX_AGE = 48 * 60 * 60 * 1000;

type CollapsedComments = Record<string, { ids: string[]; timestamp: number }>;

/** The comments that the user collapsed in each thread, which are remembered for a couple of days. */
const collapsedCommentsAtom = persistedAtom<CollapsedComments>(
  "gistpad-collapsed-comments",
  {},
  {
    parse: (value) =>
      Object.fromEntries(
        Object.entries(JSON.parse(value) as CollapsedComments).filter(
          ([, { timestamp }]) => Date.now() - timestamp < COLLAPSED_MAX_AGE,
        ),
      ),
    stringify: JSON.stringify,
  },
);

/** The comments on a widget's item (e.g. a Hacker News story), which is mounted while it's open. */
export function CommentsDialog({
  title,
  text,
  queryKey,
  fetchComments,
  onClose,
}: {
  title: string;
  text?: string;
  queryKey: unknown[];
  fetchComments: () => Promise<Comment[]>;
  onClose: () => void;
}) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const {
    data: comments = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: fetchComments,
    // Comment threads can be large, and are only viewed briefly
    meta: { persist: false },
  });

  const threadKey = JSON.stringify(queryKey);
  const collapsedIds = collapsedCommentsAtom.get()[threadKey]?.ids ?? [];

  const toggleCollapsed = (id: string, isCollapsed: boolean) =>
    collapsedCommentsAtom.set((threads) => {
      const ids = threads[threadKey]?.ids.filter((collapsedId) => collapsedId !== id) ?? [];
      const thread = { ids: isCollapsed ? [...ids, id] : ids, timestamp: Date.now() };
      return { ...threads, [threadKey]: thread };
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[95vw] md:max-w-[35vw] p-4"
        onClick={(e) => e.stopPropagation()}
        showCloseButton={false}
      >
        <DialogHeader
          className="overflow-hidden cursor-pointer"
          onClick={() => {
            const scrollContainer = scrollAreaRef.current?.querySelector(
              "[data-slot=scroll-area-viewport]",
            );
            scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <DialogTitle className="flex items-center gap-3 w-full">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <ScrollableText>{title}</ScrollableText>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 text-xs hover:text-foreground transition-colors"
                disabled={isFetching}
                title="Refresh comments"
              >
                <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              </button>
              <Separator
                orientation="vertical"
                className="h-4 data-vertical:self-center bg-separator"
              />
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea
          ref={scrollAreaRef}
          className="max-h-[80vh] pr-3 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {text && <DescriptionSection text={text} />}

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-red-500 text-sm text-center py-8">Failed to load comments</div>
          ) : comments.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">No comments yet</div>
          ) : (
            <div className="space-y-5">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isInitiallyCollapsed={collapsedIds.includes(comment.id)}
                  onToggleCollapse={toggleCollapsed}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/** The item's text, which is clamped (until it's clicked) when it's long. */
function DescriptionSection({ text }: { text: string }) {
  const [isClamped, setIsClamped] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isCollapsed = isClamped && !isExpanded;

  const measureRef = (node: HTMLDivElement | null) => {
    if (node) setIsClamped(node.scrollHeight > 250);
  };

  return (
    <div className="mb-4 p-3 bg-muted rounded-md">
      {/* (Clicking anywhere, including the "Expand text" pill, expands the text) */}
      <div
        className={cn("relative", isCollapsed && "max-h-[250px] overflow-hidden")}
        onClick={() => {
          if (isCollapsed) setIsExpanded(true);
        }}
      >
        <div ref={measureRef}>
          <MarkdownPreview>{text}</MarkdownPreview>
        </div>
        {isCollapsed && (
          <>
            {/* Gradient overlay */}
            <div className="absolute left-0 bottom-0 w-full h-8 bg-linear-to-t from-muted to-transparent pointer-events-none" />
            <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 bg-background text-foreground px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-border flex items-center gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
              <ChevronDown className="h-3 w-3" />
              <span className="text-xs font-medium whitespace-nowrap">Expand text</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const COMMENT_INDENT_PX = 12;
const MOBILE_COLLAPSE_DEPTH = 3;
const DESKTOP_COLLAPSE_DEPTH = 4;

const linkClass = "flex items-center gap-1 hover:text-foreground transition-colors hover:underline";

function CommentItem({
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
          {timeAgo(date)}
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
