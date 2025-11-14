import { EmojiInput } from "@/components/editor/EmojiInput";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    createGistComment,
    deleteGistComment,
    updateGistComment,
    type GistComment,
} from "@/lib/github";
import { formatDistanceToNow } from "date-fns";
import { Check, Pencil, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UserCommentsProps {
    comments: GistComment[];
    gistId: string;
    onCommentAdded: (comment: GistComment) => void;
    onCommentDeleted: (commentId: number) => void;
    onCommentUpdated?: (comment: GistComment) => void;
    currentUser: string | null;
    isGistOwner?: boolean;
    selectedCommentId?: number | null;
    onCommentSelected?: (commentId: number | null) => void;
    initialCommentValue?: string;
}

export default function UserComments({
    comments,
    gistId,
    onCommentAdded,
    onCommentDeleted,
    onCommentUpdated,
    currentUser,
    isGistOwner = false,
    selectedCommentId = null,
    onCommentSelected,
    initialCommentValue = "",
}: UserCommentsProps) {
    const sortedComments = [...comments].sort(
        (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const [newComment, setNewComment] = useState(initialCommentValue);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editedCommentText, setEditedCommentText] = useState("");

    const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
    const editInputRef = useRef<HTMLTextAreaElement | null>(null);
    const selectedCommentRef = useCallback(
        (commentId: number) => (element: HTMLDivElement | null) => {
            if (!element || commentId !== selectedCommentId) {
                return;
            }

            element.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        },
        [selectedCommentId]
    );

    useEffect(() => {
        if (!initialCommentValue) return;
        setNewComment(initialCommentValue);

        if (commentInputRef.current) {
            const textarea = commentInputRef.current;
            textarea.focus();
            textarea.selectionStart = textarea.value.length;
            textarea.selectionEnd = textarea.value.length;
        }
    }, [initialCommentValue]);

    useEffect(() => {
        if (editingCommentId && editInputRef.current) {
            const textarea = editInputRef.current;
            textarea.focus();
            textarea.selectionStart = textarea.value.length;
            textarea.selectionEnd = textarea.value.length;
        }
    }, [editingCommentId]);

    const handleSubmit = async () => {
        if (!newComment.trim()) return;
        setIsSubmitting(true);
        try {
            const comment = await createGistComment(gistId, newComment);
            onCommentAdded(comment);
            setNewComment("");
        } catch (error) {
            toast.error("Failed to add comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStartEditing = (commentId: number, commentBody: string) => {
        setEditingCommentId(commentId);
        setEditedCommentText(commentBody);
    };

    const handleCancelEditing = () => {
        setEditingCommentId(null);
        setEditedCommentText("");
    };

    const handleSaveEdit = async (commentId: number) => {
        if (!editedCommentText.trim()) return;

        const updatedComment = await updateGistComment(
            gistId,
            commentId,
            editedCommentText
        );
        onCommentUpdated?.(updatedComment);

        setEditingCommentId(null);
        setEditedCommentText("");
    };

    const handleDelete = async (commentId: number) => {
        try {
            await deleteGistComment(gistId, commentId);
            onCommentDeleted(commentId);
        } catch (error) {
            toast.error("Failed to delete comment");
        }
    };

    return (
        <>
            <ScrollArea className="h-full flex-1 min-h-0">
                <div className="p-2 space-y-2">
                    {sortedComments.map((comment) => (
                        <div
                            key={comment.id}
                            ref={selectedCommentRef(comment.id)}
                            onClick={() => {
                                if (editingCommentId === null) {
                                    onCommentSelected?.(
                                        comment.id === selectedCommentId ? null : comment.id
                                    );
                                }
                            }}
                            className={`flex gap-2 rounded-md p-2 ${editingCommentId === comment.id
                                ? ""
                                : `cursor-pointer transition-colors ${selectedCommentId === comment.id
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent"
                                }`
                                }`}
                        >
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={comment.user?.avatar_url} />
                                <AvatarFallback>
                                    {comment.user?.login[0].toUpperCase() ?? "A"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`font-medium text-sm truncate${!comment.user ? " italic" : ""}`}
                                        >
                                            {comment.user?.login ?? "Anonymous"}
                                        </span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDistanceToNow(comment.created_at, {
                                                addSuffix: true,
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        {currentUser === comment.user?.login &&
                                            editingCommentId !== comment.id && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEditing(comment.id, comment.body);
                                                    }}
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-500"
                                                    title="Edit comment"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            )}
                                        {(currentUser === comment.user?.login || isGistOwner) &&
                                            editingCommentId !== comment.id && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(comment.id);
                                                    }}
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                                                    title="Delete comment"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                    </div>
                                </div>
                                {editingCommentId === comment.id ? (
                                    <div className="mt-1">
                                        <EmojiInput
                                            ref={editInputRef}
                                            value={editedCommentText}
                                            onChange={(e) => setEditedCommentText(e.target.value)}
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
                                                    handleCancelEditing();
                                                }}
                                            >
                                                <X className="h-4 w-4 mr-1 text-red-500" />
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveEdit(comment.id);
                                                }}
                                                disabled={!editedCommentText.trim()}
                                            >
                                                <Check className="h-4 w-4 mr-1 text-green-500" />
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-1">
                                        <MarkdownPreview
                                            shouldInvert={selectedCommentId !== comment.id}
                                            enableBlockquoteCopying={false}
                                        >
                                            {comment.body}
                                        </MarkdownPreview>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {comments.length === 0 && (
                        <div className="text-center text-muted-foreground italic mt-4 p-2">
                            This gist doesn't have any comments yet. Add one below!
                        </div>
                    )}
                </div>
            </ScrollArea>
            <div className="border-t p-3">
                <div className="flex gap-2">
                    <EmojiInput
                        ref={commentInputRef}
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px]"
                        type="textarea"
                    />
                </div>
                <div className="flex justify-end mt-2">
                    <Button
                        onClick={handleSubmit}
                        disabled={!newComment.trim() || isSubmitting}
                        size="sm"
                    >
                        <Send className="h-4 w-4 mr-2" />
                        Comment
                    </Button>
                </div>
            </div>
        </>
    );
}
