import { Badge } from "@/components/ui/badge";
import { EmojiInput } from "@/components/editor/EmojiInput";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CommentThread,
  createReplyMarker,
  findCommentInThreads,
  getCommentPrefix,
  getDisplayBody,
  getSidebarDisplayBody,
} from "@/lib/comments";
import {
  createGistComment,
  deleteGistComment,
  updateGistComment,
  type GistComment,
} from "@/lib/github";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// Maximum nesting depth for replies (0 = top-level, 1 = reply, 2 = reply-to-reply)
const MAX_REPLY_DEPTH = 2;

// ============================================================================
// Context - Minimal, just what's needed to avoid prop drilling
// ============================================================================

interface CommentActions {
  selectedCommentId: number | null;
  editingCommentId: number | null;
  editedText: string;
  currentUser: string | null;
  isGistOwner: boolean;
  onSelect: (id: number | null) => void;
  onStartReply: (id: number) => void;
  onStartEdit: (id: number, body: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onEditTextChange: (text: string) => void;
  editInputRef: React.RefObject<HTMLTextAreaElement | null>;
  getScrollRef: (commentId: number) => (el: HTMLDivElement | null) => void;
}

const CommentActionsContext = createContext<CommentActions | null>(null);

function useCommentActions(): CommentActions {
  const ctx = useContext(CommentActionsContext);
  if (!ctx) throw new Error("CommentActionsContext not found");
  return ctx;
}

// ============================================================================
// CommentActions - Reply button or dropdown menu for edit/delete
// ============================================================================

interface CommentActionsProps {
  comment: GistComment;
  depth: number;
  canEdit: boolean;
  canDelete: boolean;
  onStartReply: (id: number) => void;
  onStartEdit: (id: number, body: string) => void;
  onDelete: (id: number) => void;
}

function CommentActions({
  comment,
  depth,
  canEdit,
  canDelete,
  onStartReply,
  onStartEdit,
  onDelete,
}: CommentActionsProps) {
  const canReply = depth < MAX_REPLY_DEPTH;

  // Own comment: show menu with reply (if allowed), edit, and delete
  if (canEdit) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {canReply && (
            <>
              <DropdownMenuItem onClick={() => onStartReply(comment.id)}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => onStartEdit(comment.id, comment.body)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit comment
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(comment.id)}
            className="text-red-500 focus:text-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete comment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Someone else's comment: show reply button, plus delete menu if gist owner
  if (!canReply && !canDelete) return null;

  return (
    <div className="flex gap-1">
      {canReply && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onStartReply(comment.id);
          }}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
          title="Reply to comment"
        >
          <Reply className="h-4 w-4" />
        </Button>
      )}
      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() => onDelete(comment.id)}
              className="text-red-500 focus:text-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete comment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ============================================================================
// CommentItem - Individual comment display
// ============================================================================

function CommentItem({ comment, depth }: { comment: GistComment; depth: number }) {
  const {
    selectedCommentId,
    editingCommentId,
    editedText,
    currentUser,
    isGistOwner,
    onSelect,
    onStartReply,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onDelete,
    onEditTextChange,
    editInputRef,
    getScrollRef,
  } = useCommentActions();

  const isSelected = selectedCommentId === comment.id;
  const isEditing = editingCommentId === comment.id;
  const canEdit = currentUser === comment.user?.login;
  const canDelete = canEdit || isGistOwner;

  return (
    <div
      ref={getScrollRef(comment.id)}
      data-comment-id={comment.id}
      onClick={() => !isEditing && onSelect(isSelected ? null : comment.id)}
      className={`flex gap-2 rounded-md p-2 ${
        isEditing
          ? ""
          : `cursor-pointer transition-colors ${
              isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`
      }`}
      style={{ marginLeft: depth > 0 ? `${depth * 28}px` : undefined }}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={comment.user?.avatar_url} />
        <AvatarFallback>{comment.user?.login?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm truncate${!comment.user ? " italic" : ""}`}>
              {comment.user?.login ?? "Anonymous"}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(comment.created_at, { addSuffix: true })}
            </span>
          </div>
          {!isEditing && (
            <CommentActions
              comment={comment}
              depth={depth}
              canEdit={canEdit}
              canDelete={canDelete}
              onStartReply={onStartReply}
              onStartEdit={onStartEdit}
              onDelete={onDelete}
            />
          )}
        </div>
        {isEditing ? (
          <div className="mt-1">
            <EmojiInput
              ref={editInputRef}
              value={editedText}
              onChange={(e) => onEditTextChange(e.target.value)}
              className="min-h-[80px]"
              type="textarea"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit();
                }}
              >
                <X className="h-4 w-4 mr-1 text-red-500" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveEdit(comment.id);
                }}
                disabled={!editedText.trim()}
              >
                <Check className="h-4 w-4 mr-1 text-green-500" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <MarkdownPreview shouldInvert={!isSelected} enableBlockquoteCopying={false}>
              {getSidebarDisplayBody(comment.body)}
            </MarkdownPreview>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CommentThread - Recursive thread rendering with collapsible replies
// ============================================================================

function CommentThreadView({ thread, depth }: { thread: CommentThread; depth: number }) {
  // Auto-collapse replies to replies (depth >= 1), but keep top-level replies expanded
  const [isCollapsed, setIsCollapsed] = useState(depth >= 1);
  const replyCount = thread.replies.length;
  const hasReplies = replyCount > 0;

  // Calculate left margin for the toggle button (matches comment indentation + avatar offset)
  const toggleMarginLeft = depth > 0 ? `${depth * 28 + 40}px` : "40px";

  return (
    <div>
      <CommentItem comment={thread.comment} depth={depth} />

      {/* Collapse/expand toggle - shown for any comment with replies */}
      {hasReplies && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 mb-1"
          style={{ marginLeft: toggleMarginLeft }}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </button>
      )}

      {/* Replies - hidden when collapsed */}
      {!isCollapsed &&
        thread.replies.map((reply) => (
          <CommentThreadView key={reply.comment.id} thread={reply} depth={depth + 1} />
        ))}
    </div>
  );
}

// ============================================================================
// CommentInput - New comment/reply input
// ============================================================================

function CommentInput({
  gistId,
  replyingTo,
  onCancelReply,
  onCommentAdded,
  initialValue = "",
}: {
  gistId: string;
  replyingTo: GistComment | null;
  onCancelReply: () => void;
  onCommentAdded: (comment: GistComment) => void;
  initialValue?: string;
}) {
  const [text, setText] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync text state when initialValue changes (e.g., when quoting selected text)
  useEffect(() => {
    if (initialValue) {
      setText(initialValue);
    }
  }, [initialValue]);

  // Focus when entering reply mode or when initial value is set.
  // Use a longer delay to ensure focus happens after dropdown menus close and scroll completes.
  useEffect(() => {
    if (replyingTo || initialValue) {
      const timer = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [replyingTo?.id, initialValue]);

  const handleSubmit = async () => {
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      const body = replyingTo ? createReplyMarker(replyingTo.id) + text : text;
      const comment = await createGistComment(gistId, body);
      onCommentAdded(comment);
      setText("");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-t px-3 pt-2 pb-3">
      {replyingTo && (
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="flex items-center gap-1 pr-1">
            <span>Replying to @{replyingTo.user?.login ?? "Anonymous"}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelReply}
              className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        </div>
      )}
      <EmojiInput
        ref={inputRef}
        placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[80px]"
        type="textarea"
      />
      <div className="flex justify-end mt-2">
        <Button onClick={handleSubmit} disabled={!text.trim() || isSubmitting} size="sm">
          <Send className="h-4 w-4 mr-2" />
          {replyingTo ? "Reply" : "Comment"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// UserComments - Main component
// ============================================================================

interface UserCommentsProps {
  commentThreads: CommentThread[];
  gistId: string;
  onCommentAdded: (comment: GistComment) => void;
  onCommentDeleted: (commentId: number) => void;
  onCommentUpdated?: (comment: GistComment) => void;
  currentUser: string | null;
  isGistOwner?: boolean;
  selectedCommentId?: number | null;
  onCommentSelected?: (commentId: number | null) => void;
  initialCommentValue?: string;
  replyingToCommentId?: number | null;
  onReplyingToCommentChanged?: (commentId: number | null) => void;
}

export default function UserComments({
  commentThreads,
  gistId,
  onCommentAdded,
  onCommentDeleted,
  onCommentUpdated,
  currentUser,
  isGistOwner = false,
  selectedCommentId = null,
  onCommentSelected,
  initialCommentValue = "",
  replyingToCommentId = null,
  onReplyingToCommentChanged,
}: UserCommentsProps) {
  // Local editing state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedPrefix, setEditedPrefix] = useState(""); // Hidden prefix (reply marker or quote)
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Derived state
  const replyingToComment = useMemo(
    () => (replyingToCommentId ? findCommentInThreads(commentThreads, replyingToCommentId) : null),
    [replyingToCommentId, commentThreads],
  );

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingCommentId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.selectionStart = editInputRef.current.value.length;
    }
  }, [editingCommentId]);

  // Scroll selected comment into view using ref callback
  const getScrollRef = useCallback(
    (commentId: number) => (el: HTMLDivElement | null) => {
      if (el && commentId === selectedCommentId) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [selectedCommentId],
  );

  // Actions
  const handleSelect = useCallback(
    (id: number | null) => onCommentSelected?.(id),
    [onCommentSelected],
  );

  const handleStartReply = useCallback(
    (id: number) => {
      onCommentSelected?.(id);
      onReplyingToCommentChanged?.(id);
    },
    [onCommentSelected, onReplyingToCommentChanged],
  );

  const handleCancelReply = useCallback(() => {
    onReplyingToCommentChanged?.(null);
  }, [onReplyingToCommentChanged]);

  const handleSaveEdit = useCallback(
    async (commentId: number) => {
      if (!editedText.trim()) return;
      try {
        // Restore the hidden prefix (reply marker or quote) when saving
        const fullBody = editedPrefix + editedText;
        const updated = await updateGistComment(gistId, commentId, fullBody);
        onCommentUpdated?.(updated);
        setEditingCommentId(null);
        setEditedText("");
        setEditedPrefix("");
      } catch {
        toast.error("Failed to update comment");
      }
    },
    [gistId, editedText, editedPrefix, onCommentUpdated],
  );

  const handleDelete = useCallback(
    async (commentId: number) => {
      try {
        await deleteGistComment(gistId, commentId);
        onCommentDeleted(commentId);
      } catch {
        toast.error("Failed to delete comment");
      }
    },
    [gistId, onCommentDeleted],
  );

  // Context value - memoized to prevent unnecessary re-renders
  const actions = useMemo<CommentActions>(
    () => ({
      selectedCommentId,
      editingCommentId,
      editedText,
      currentUser,
      isGistOwner,
      onSelect: handleSelect,
      onStartReply: handleStartReply,
      onStartEdit: (id, body) => {
        setEditingCommentId(id);
        setEditedPrefix(getCommentPrefix(body));
        setEditedText(getDisplayBody(body));
      },
      onCancelEdit: () => {
        setEditingCommentId(null);
        setEditedText("");
        setEditedPrefix("");
      },
      onSaveEdit: handleSaveEdit,
      onDelete: handleDelete,
      onEditTextChange: setEditedText,
      editInputRef,
      getScrollRef,
    }),
    [
      selectedCommentId,
      editingCommentId,
      editedText,
      currentUser,
      isGistOwner,
      handleSelect,
      handleStartReply,
      handleSaveEdit,
      handleDelete,
      getScrollRef,
    ],
  );

  return (
    <CommentActionsContext.Provider value={actions}>
      <ScrollArea className="h-full flex-1 min-h-0">
        <div className="p-2 space-y-2">
          {commentThreads.map((thread) => (
            <CommentThreadView key={thread.comment.id} thread={thread} depth={0} />
          ))}

          {commentThreads.length === 0 && (
            <div className="text-center text-muted-foreground italic mt-4 p-2">
              This gist doesn't have any comments yet. Add one below!
            </div>
          )}
        </div>
      </ScrollArea>
      <CommentInput
        gistId={gistId}
        replyingTo={replyingToComment}
        onCancelReply={handleCancelReply}
        onCommentAdded={onCommentAdded}
        initialValue={initialCommentValue}
      />
    </CommentActionsContext.Provider>
  );
}
