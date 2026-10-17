import { EmojiInput } from "@/shared/EmojiInput";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/shared/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { ScrollArea } from "@/shared/ui/scroll-area";
import type { GistDocument } from "@/features/editor/document";
import {
  createReplyMarker,
  getCommentPrefix,
  getDisplayBody,
  getSidebarDisplayBody,
  type CommentThread,
} from "./threads";
import type { GistComment } from "@/shared/github";
import { useCreateComment, useDeleteComment, useUpdateComment } from "@/features/gists/queries";
import { useSession } from "@/features/account/queries";
import { commentsStore, openComments, updateComments } from "./store";
import { useSelector } from "@tanstack/react-store";
import { Collapsible } from "@base-ui/react/collapsible";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, ChevronRight, MoreHorizontal, Pencil, Reply, Trash2, X } from "lucide-react";
import { createContext, use, useEffect, useRef, useState } from "react";
import { useCommentThreads } from "./useCommentThreads";

// The maximum nesting depth for replies (0 = top-level, 1 = reply, 2 = reply-to-reply)
const MAX_REPLY_DEPTH = 2;
const INDENT_PX = 28;

const CommentsContext = createContext<{
  gistId: string;
  currentUser?: string;
  isGistOwner: boolean;
}>({
  gistId: "",
  isGistOwner: false,
});

/** Reply, edit and delete actions (depending on who wrote the comment, and who owns the gist). */
function CommentActions({
  comment,
  depth,
  onEdit,
}: {
  comment: GistComment;
  depth: number;
  onEdit: () => void;
}) {
  const { gistId, currentUser, isGistOwner } = use(CommentsContext);
  const { mutate: deleteComment } = useDeleteComment(gistId);

  const canReply = depth < MAX_REPLY_DEPTH;
  const canEdit = currentUser === comment.user?.login;
  const canDelete = canEdit || isGistOwner;
  const reply = () => openComments({ commentId: comment.id, reply: true });

  return (
    <div className="flex gap-1">
      {/* Other people's comments have a dedicated reply button (rather than a menu item). */}
      {canReply && !canEdit && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            reply();
          }}
          className="text-muted-foreground hover:text-primary"
          title="Reply to comment"
        >
          <Reply />
        </Button>
      )}
      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          {/* Don't return focus to the trigger, since replying focuses the comment input. */}
          <DropdownMenuContent align="end" finalFocus={false} onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <>
                {canReply && (
                  <>
                    <DropdownMenuItem onClick={reply}>
                      <Reply /> Reply
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil /> Edit comment
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem variant="destructive" onClick={() => deleteComment(comment.id)}>
              <Trash2 /> Delete comment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Edits a comment, while preserving its hidden prefix (i.e. a reply marker or quote). */
function CommentEditor({ comment, onDone }: { comment: GistComment; onDone: () => void }) {
  const { gistId } = use(CommentsContext);
  const { mutate: updateComment } = useUpdateComment(gistId);
  const [text, setText] = useState(() => getDisplayBody(comment.body));

  return (
    <InputGroup className="mt-1" onClick={(e) => e.stopPropagation()}>
      <EmojiInput
        value={text}
        onValueChange={setText}
        multiline
        className="min-h-[80px]"
        autoFocus
        onFocus={(e) => e.currentTarget.setSelectionRange(text.length, text.length)}
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <InputGroupButton onClick={onDone}>Cancel</InputGroupButton>
        <InputGroupButton
          variant="default"
          disabled={!text.trim()}
          onClick={() =>
            updateComment(
              { commentId: comment.id, body: getCommentPrefix(comment.body) + text },
              { onSuccess: onDone },
            )
          }
        >
          Save
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** Scrolls the selected comment into view, whenever it's (newly) selected. */
const scrollIntoView = (element: HTMLElement | null) =>
  element?.scrollIntoView({ behavior: "smooth", block: "center" });

function CommentItem({ comment, depth }: { comment: GistComment; depth: number }) {
  const isSelected = useSelector(commentsStore, (state) => state.selectedCommentId === comment.id);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      ref={isSelected ? scrollIntoView : undefined}
      data-comment-id={comment.id}
      onClick={() =>
        !isEditing && updateComments({ selectedCommentId: isSelected ? null : comment.id })
      }
      className={`flex gap-2 rounded-md p-2 ${
        isEditing
          ? ""
          : `cursor-pointer transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent/50 hover:text-accent-foreground"}`
      }`}
      style={{ marginLeft: depth * INDENT_PX || undefined }}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={comment.user?.avatar_url} />
        <AvatarFallback>{comment.user?.login?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm truncate${comment.user ? "" : " italic"}`}>
              {comment.user?.login ?? "Anonymous"}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(comment.created_at, { addSuffix: true })}
            </span>
          </div>
          {!isEditing && (
            <CommentActions comment={comment} depth={depth} onEdit={() => setIsEditing(true)} />
          )}
        </div>
        {isEditing ? (
          <CommentEditor comment={comment} onDone={() => setIsEditing(false)} />
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

/** A comment and its replies (where replies to replies are collapsed by default). */
function CommentThreadView({ thread, depth }: { thread: CommentThread; depth: number }) {
  const replyCount = thread.replies.length;

  return (
    <Collapsible.Root defaultOpen={depth === 0}>
      <CommentItem comment={thread.comment} depth={depth} />
      {replyCount > 0 && (
        <Collapsible.Trigger
          className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground my-1"
          // Aligns the toggle with the comment's text (i.e. after its avatar)
          style={{ marginLeft: depth * INDENT_PX + 40 }}
        >
          <ChevronRight className="h-3 w-3 group-data-panel-open:rotate-90" />
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </Collapsible.Trigger>
      )}
      <Collapsible.Panel>
        {thread.replies.map((reply) => (
          <CommentThreadView key={reply.comment.id} thread={reply} depth={depth + 1} />
        ))}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function CommentInput({ comments }: { comments: GistComment[] }) {
  const { gistId } = use(CommentsContext);
  const { mutate: createComment, isPending } = useCreateComment(gistId);
  const text = useSelector(commentsStore, (state) => state.newCommentText);
  const shouldFocus = useSelector(commentsStore, (state) => state.shouldFocusInput);
  const replyingToId = useSelector(commentsStore, (state) => state.replyingToCommentId);
  const replyingTo = comments.find(({ id }) => id === replyingToId);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!shouldFocus) return;
    inputRef.current?.focus();
    updateComments({ shouldFocusInput: false });
  }, [shouldFocus]);

  const submit = () =>
    createComment(replyingTo ? createReplyMarker(replyingTo.id) + text : text, {
      onSuccess: (comment) =>
        updateComments({
          newCommentText: "",
          replyingToCommentId: null,
          selectedCommentId: comment.id,
        }),
    });

  return (
    <div className="border-t p-3">
      <InputGroup>
        {replyingTo && (
          <InputGroupAddon align="block-start">
            <Badge variant="secondary" className="gap-1 pr-1">
              Replying to @{replyingTo.user?.login ?? "Anonymous"}
              <InputGroupButton
                size="icon-xs"
                onClick={() => updateComments({ replyingToCommentId: null })}
                className="size-4 hover:bg-transparent"
                aria-label="Cancel reply"
              >
                <X className="size-3" />
              </InputGroupButton>
            </Badge>
          </InputGroupAddon>
        )}
        <EmojiInput
          ref={inputRef}
          placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
          value={text}
          onValueChange={(newCommentText) => updateComments({ newCommentText })}
          multiline
          className="min-h-[80px]"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            variant="default"
            size="icon-xs"
            className="ml-auto rounded-md"
            onClick={submit}
            disabled={!text.trim() || isPending}
            aria-label={replyingTo ? "Reply" : "Comment"}
          >
            <ArrowUp />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

/** The (threaded) comments on a gist, and an input for adding new ones. */
export default function UserComments({ doc }: { doc: GistDocument }) {
  const { comments, threads } = useCommentThreads(doc);
  const { user } = useSession();

  return (
    <CommentsContext
      value={{
        gistId: doc.gistId ?? "",
        currentUser: user?.login,
        isGistOwner: !!user && doc.gist?.owner?.login === user.login,
      }}
    >
      <ScrollArea className="h-full flex-1 min-h-0">
        <div className="p-2 space-y-2">
          {threads.map((thread) => (
            <CommentThreadView key={thread.comment.id} thread={thread} depth={0} />
          ))}
          {threads.length === 0 && (
            <div className="text-center text-muted-foreground italic mt-4 p-2">
              This gist doesn't have any comments yet. Add one below!
            </div>
          )}
        </div>
      </ScrollArea>
      <CommentInput comments={comments} />
    </CommentsContext>
  );
}
