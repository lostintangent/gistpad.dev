import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { AgentFollowUp } from "@/agents/openai";
import { ReviewComment } from "@/agents/qa/review";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckSquare,
  ChevronDown,
  ClipboardCopy,
  Lightbulb,
  Loader2,
  MessageSquareHeart,
  MessageSquareReply,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import ApplyCommentDialog from "../dialogs/ApplyCommentDialog";

import { AiLoadingMessage } from "@/components/AiLoadingMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowUpButton } from "../ai/FollowUpButton";

interface AiCommentsProps {
  comments: ReviewComment[];
  onCommentDeleted: (id: number) => void;
  onAcceptComment: (comment: ReviewComment, input?: string) => void;
  isCommandInProgress: boolean;
  isReviewInProgress: boolean;
  commentBeingApplied: number | null;
  reviewRequest: string;
  reviewTitle?: string;
  appliedAiComments: number[];
  onRegenerate?: (input?: string) => void;
  onClearComments?: () => void;
  followUp?: AgentFollowUp | null;
  onFollowUp?: (topic: string) => void;
  reasoningSummary?: string;
  isWebSearching?: boolean;
}

export default function AiComments({
  comments,
  onCommentDeleted,
  onAcceptComment,
  isCommandInProgress = false,
  isReviewInProgress = false,
  commentBeingApplied = null,
  reviewRequest = "",
  reviewTitle,
  appliedAiComments = [],
  onRegenerate,
  onClearComments,
  followUp = null,
  onFollowUp,
  reasoningSummary,
  isWebSearching = false,
}: AiCommentsProps) {
  const [showClarifyDialog, setShowClarifyDialog] = useState(false);
  const [selectedComment, setSelectedComment] = useState<ReviewComment | null>(
    null
  );
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateInput, setRegenerateInput] = useState("");

  return (
    <>
      <ScrollArea className="h-full flex-1 [&>div>div]:block!">
        <div className="p-3 space-y-4">
          {reviewRequest && (
            <div className="mb-4">
              <div className="flex items-start justify-between text-muted-foreground italic mb-4 gap-1">
                {reviewTitle ? (
                  <span className="flex-1">{reviewTitle}</span>
                ) : (
                  <Skeleton className="h-5 w-3/4 mt-1" />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 text-foreground hover:text-amber-500 flex items-center gap-1"
                      title="Regenerate comments"
                      disabled={isCommandInProgress}
                    >
                      <RotateCcw className="h-4 w-4" />
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => onRegenerate()}
                      disabled={isCommandInProgress}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Retry
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        setTimeout(() => setShowRegenerateDialog(true), 100)
                      }
                      disabled={isCommandInProgress}
                    >
                      <MessageSquareReply className="h-4 w-4 mr-2" />
                      Retry w/input
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearComments}
                    className="h-6 w-6 p-0 text-foreground hover:text-green-500"
                    title="Clear comments"
                    disabled={isCommandInProgress}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                </DropdownMenu>
              </div>
              <Separator />
            </div>
          )}

          <>
            {comments.map((comment, index) => (
              <div
                key={index}
                className={`space-y-2${appliedAiComments.includes(comment.id) ? " text-muted-foreground italic opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      {comment.heading ?? <Skeleton className="h-5 w-3/4" />}
                    </h3>
                    {comment.comment ? (
                      <MarkdownPreview enableBlockquoteCopying={false}>
                        {comment.comment}
                      </MarkdownPreview>
                    ) : (
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-5 w-1/2" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 flex items-center gap-1 px-1 text-foreground hover:text-amber-500"
                          title="Apply feedback"
                        >
                          {commentBeingApplied === comment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                          ) : (
                            <Lightbulb className="h-4 w-4" />
                          )}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => onAcceptComment(comment)}
                          disabled={isCommandInProgress}
                        >
                          <MessageSquareHeart className="h-4 w-4 mr-2" />
                          Apply comment
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedComment(comment);
                            setTimeout(() => setShowClarifyDialog(true), 100);
                          }}
                          disabled={isCommandInProgress}
                        >
                          <MessageSquareReply className="h-4 w-4 mr-2" />
                          Apply w/input
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCommentDeleted(comment.id)}
                      className="h-6 w-6 p-0 text-foreground hover:text-green-500"
                      title="Resolve comment"
                      disabled={isCommandInProgress}
                    >
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {comment.referencedText && (
                  <div>
                    <div className="text-sm text-muted-foreground mt-4">
                      {comment.isExample ? "Example" : "Referenced"} text
                    </div>
                    <div className="mt-1 mr-1 bg-muted p-2 pb-1 rounded-md mb-4">
                      <MarkdownPreview enableBlockquoteCopying={false}>
                        {comment.referencedText}
                      </MarkdownPreview>
                    </div>
                  </div>
                )}
                {(comment.insertAfter ?? comment.replaceWith) && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      {comment.replaceWith !== null
                        ? "Replace with"
                        : "Insert after"}
                      <ClipboardCopy
                        className="h-4 w-4 cursor-pointer hover:text-green-500"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            comment.replaceWith || comment.insertAfter || ""
                          )
                        }
                      />
                    </div>
                    <div className="mt-1 mr-1 bg-blue-500/10 p-2 rounded-md mb-4">
                      <MarkdownPreview enableBlockquoteCopying={false}>
                        {comment.replaceWith || comment.insertAfter}
                      </MarkdownPreview>
                    </div>
                  </div>
                )}
                {index < comments.length - 1 && <Separator className="my-4" />}
              </div>
            ))}

            {isReviewInProgress ? (
              <>
                {comments.length > 0 && <Separator className="my-4" />}
                <div className="relative mt-8!">
                  <AiLoadingMessage
                    reasoningSummary={reasoningSummary}
                    isWebSearching={isWebSearching}
                  />
                </div>
              </>
            ) : followUp?.question ? (
              <>
                <Separator className="my-4" />
                <FollowUpButton
                  question={followUp.question}
                  onClick={() => onFollowUp(followUp.topic)}
                  className="mt-4"
                  disabled={isReviewInProgress}
                />
              </>
            ) : (
              comments.length === 0 && (
                <div className="text-center text-muted-foreground italic">
                  Your request didn't result in any comments. Maybe try asking a
                  different question?
                </div>
              )
            )}
          </>
        </div>
      </ScrollArea>

      <ApplyCommentDialog
        isOpen={showClarifyDialog}
        onOpenChange={setShowClarifyDialog}
        comment={selectedComment?.comment ?? ""}
        onApply={(clarification) => {
          if (selectedComment) {
            onAcceptComment(selectedComment, clarification);
            setSelectedComment(null);
          }
        }}
      />

      <Dialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Comments</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Textarea
              value={regenerateInput}
              onChange={(e) => setRegenerateInput(e.target.value)}
              placeholder="Provide additional context or instructions for regeneration..."
              className="h-32"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                onRegenerate?.(regenerateInput);
                setShowRegenerateDialog(false);
                setRegenerateInput("");
              }}
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
