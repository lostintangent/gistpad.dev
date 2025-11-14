import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { ScrollableText } from "@/components/ScrollableText";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MessageSquare, RefreshCw, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Comment } from "../types";
import { CommentItem } from "./CommentItem";
import { useCollapsedComments } from "./useCollapsedComments";

export interface CommentsDialogProps {
  title: string;
  text?: string;
  isOpen: boolean;
  onClose: () => void;
  queryKey: any[];
  fetchComments: () => Promise<Comment[]>;
}

export function CommentsDialog({
  title,
  text,
  isOpen,
  onClose,
  queryKey,
  fetchComments,
}: CommentsDialogProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { isCollapsed, handleToggleCollapse } = useCollapsedComments(
    queryKey,
    isOpen
  );

  const {
    data: comments = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: fetchComments,
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] md:max-w-[35vw] p-4"
        onClick={(e) => e.stopPropagation()}
        showCloseButton={false}
      >
        <DialogHeader
          className="overflow-hidden cursor-pointer"
          onClick={() => {
            const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
            scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <DialogTitle className="flex items-center gap-3 w-full">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <ScrollableText>{title}</ScrollableText>
            </div>
            <div className="flex items-center gap-2">
              <RefreshButton
                onRefresh={() => refetch()}
                isFetching={isFetching}
              />
              <div className="h-4 w-px bg-border" />
              <CloseButton onClose={onClose} />
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
            <LoadingSkeleton />
          ) : error ? (
            <ErrorMessage />
          ) : comments.length === 0 ? (
            <EmptyState />
          ) : (
            <CommentsList
              comments={comments}
              isCollapsed={isCollapsed}
              onToggleCollapse={handleToggleCollapse}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Sub-components for better organization
function RefreshButton({
  onRefresh,
  isFetching,
}: {
  onRefresh: () => void;
  isFetching: boolean;
}) {
  return (
    <button
      onClick={onRefresh}
      className="flex items-center gap-1 text-xs hover:text-foreground transition-colors"
      disabled={isFetching}
      title="Refresh comments"
    >
      <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
    </button>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Close"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function DescriptionSection({ text }: { text: string }) {
  const [isClamped, setIsClamped] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setIsClamped(node.scrollHeight > 250);
    }
  }, [text]);

  return (
    <div className="mb-4 p-3 bg-muted rounded-md">
      <div
        className={cn(
          "relative",
          isClamped && !isExpanded && "max-h-[250px] overflow-hidden"
        )}
        onClick={() => {
          if (isClamped && !isExpanded) {
            setIsExpanded(true);
          }
        }}
      >
        <div ref={measureRef}>
          <MarkdownPreview>{text}</MarkdownPreview>
        </div>
        {isClamped && !isExpanded && (
          <>
            {/* Gradient overlay */}
            <div className="absolute left-0 bottom-0 w-full h-8 bg-linear-to-t from-muted to-transparent pointer-events-none" />
            {/* Expand pill */}
            <div
              className="absolute left-1/2 bottom-0 transform -translate-x-1/2 bg-background text-foreground px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-border flex items-center gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
            >
              <ChevronDown className="h-3 w-3" />
              <span className="text-xs font-medium whitespace-nowrap">
                Expand text
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
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
  );
}

function ErrorMessage() {
  return (
    <div className="text-red-500 text-sm text-center py-8">
      Failed to load comments
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground text-center py-8">
      No comments yet
    </div>
  );
}

function CommentsList({
  comments,
  isCollapsed,
  onToggleCollapse,
}: {
  comments: any[];
  isCollapsed: (id: string) => boolean;
  onToggleCollapse: (id: string, collapsed: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          isInitiallyCollapsed={isCollapsed(comment.id)}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  );
}
