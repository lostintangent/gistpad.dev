import type { ReviewComment } from "./agents/qa/review";
import { AiLoadingMessage } from "./AiLoadingMessage";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  clearReview,
  updateAiResult,
  useIsAiInProgress,
  useRunningMode,
  type AiReview,
} from "./store";
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
import { useState, type ReactNode } from "react";
import { useAiCommands, type AiCommands } from "./useAiCommands";
import { FollowUpButton } from "./FollowUpButton";
import InstructionsDialog from "./dialogs/InstructionsDialog";

/** Resolves a comment, which clears the review once all of its comments are resolved. */
function resolveComment(review: AiReview, commentId: number) {
  if (review.comments.length === 1) return clearReview();
  updateAiResult("review", ({ comments }) => ({
    comments: comments.filter(({ id }) => id !== commentId),
  }));
}

/** A menu for running a command (e.g. as-is, or with additional instructions). */
function CommandMenu({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 gap-1 text-foreground hover:text-amber-500"
            title={title}
          />
        }
      >
        {icon}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function SuggestedText({
  label,
  text,
  className,
  actions,
}: {
  label: ReactNode;
  text: string;
  className: string;
  actions?: ReactNode;
}) {
  return (
    <div>
      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-4">
        {label}
        {actions}
      </div>
      <div className={`mt-1 mr-1 p-2 pb-1 rounded-md mb-4 ${className}`}>
        <MarkdownPreview enableBlockquoteCopying={false}>{text}</MarkdownPreview>
      </div>
    </div>
  );
}

function ReviewCommentView({
  review,
  comment,
  ai,
  onApplyWithInstructions,
}: {
  review: AiReview;
  comment: ReviewComment;
  ai: AiCommands;
  onApplyWithInstructions: () => void;
}) {
  const isAiInProgress = useIsAiInProgress();
  const isApplied = review.appliedCommentIds.includes(comment.id);
  const suggestion = comment.replaceWith || comment.insertAfter;

  return (
    <div className={`space-y-2${isApplied ? " text-muted-foreground italic opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">
            {comment.heading ?? <Skeleton className="h-5 w-3/4" />}
          </h3>
          {comment.comment ? (
            <MarkdownPreview enableBlockquoteCopying={false}>{comment.comment}</MarkdownPreview>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <CommandMenu
            title="Apply feedback"
            icon={
              review.applyingCommentId === comment.id ? (
                <Loader2 className="animate-spin text-green-500" />
              ) : (
                <Lightbulb />
              )
            }
          >
            <DropdownMenuItem
              onClick={() => ai.applyReviewComment(comment)}
              disabled={isAiInProgress}
            >
              <MessageSquareHeart /> Apply comment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onApplyWithInstructions} disabled={isAiInProgress}>
              <MessageSquareReply /> Apply w/input
            </DropdownMenuItem>
          </CommandMenu>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => resolveComment(review, comment.id)}
            className="text-foreground hover:text-green-500"
            title="Resolve comment"
            disabled={isAiInProgress}
          >
            <CheckSquare />
          </Button>
        </div>
      </div>
      {comment.referencedText && (
        <SuggestedText
          label={`${comment.isExample ? "Example" : "Referenced"} text`}
          text={comment.referencedText}
          className="bg-muted"
        />
      )}
      {suggestion && (
        <SuggestedText
          label={comment.replaceWith ? "Replace with" : "Insert after"}
          text={suggestion}
          className="bg-blue-500/10"
          actions={
            <button
              onClick={() => navigator.clipboard.writeText(suggestion)}
              className="hover:text-green-500"
              title="Copy to clipboard"
            >
              <ClipboardCopy className="h-4 w-4" />
            </button>
          }
        />
      )}
    </div>
  );
}

/** The comments from an AI review of the file, which can be applied (as AI edits) or resolved. */
export default function AiComments({ review }: { review: AiReview }) {
  const ai = useAiCommands();
  const isAiInProgress = useIsAiInProgress();
  const isReviewing = useRunningMode() === "review";
  const [instructionsFor, setInstructionsFor] = useState<ReviewComment | "retry" | null>(null);

  const status = isReviewing ? (
    <div className="relative mt-8!">
      <AiLoadingMessage
        reasoningSummary={review.reasoningSummary}
        isWebSearching={review.isWebSearching}
      />
    </div>
  ) : review.followUp?.question ? (
    <FollowUpButton
      question={review.followUp.question}
      onClick={() => ai.run(review.followUp!.topic, "review")}
      className="mt-4"
    />
  ) : (
    review.comments.length === 0 && (
      <div className="text-center text-muted-foreground italic">
        Your request didn't result in any comments. Maybe try asking a different question?
      </div>
    )
  );

  return (
    <>
      <ScrollArea className="h-full flex-1 min-h-0">
        <div className="p-3 space-y-4">
          <div className="mb-4">
            <div className="flex items-start justify-between text-muted-foreground italic mb-4 gap-1">
              {review.title ? (
                <span className="flex-1">{review.title}</span>
              ) : (
                <Skeleton className="h-5 w-3/4 mt-1" />
              )}
              <CommandMenu title="Regenerate comments" icon={<RotateCcw />}>
                <DropdownMenuItem onClick={() => ai.retryReview()} disabled={isAiInProgress}>
                  <RotateCcw /> Retry
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setInstructionsFor("retry")}
                  disabled={isAiInProgress}
                >
                  <MessageSquareReply /> Retry w/input
                </DropdownMenuItem>
              </CommandMenu>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={clearReview}
                className="text-foreground hover:text-green-500"
                title="Clear comments"
                disabled={isAiInProgress}
              >
                <CheckSquare />
              </Button>
            </div>
            <Separator />
          </div>

          {review.comments.map((comment, index) => (
            <div key={comment.id}>
              {index > 0 && <Separator className="my-4" />}
              <ReviewCommentView
                review={review}
                comment={comment}
                ai={ai}
                onApplyWithInstructions={() => setInstructionsFor(comment)}
              />
            </div>
          ))}

          {status && (
            <>
              {review.comments.length > 0 && <Separator className="my-4" />}
              {status}
            </>
          )}
        </div>
      </ScrollArea>

      {instructionsFor === "retry" ? (
        <InstructionsDialog
          title="Regenerate comments"
          placeholder="Provide additional context or instructions for regeneration..."
          submitLabel="Regenerate"
          onClose={() => setInstructionsFor(null)}
          onSubmit={(instructions) => ai.retryReview(instructions)}
        />
      ) : (
        instructionsFor && (
          <InstructionsDialog
            title="Apply comment"
            placeholder="How would you like to apply this comment?"
            submitLabel="Apply"
            details={instructionsFor.comment}
            onClose={() => setInstructionsFor(null)}
            onSubmit={(instructions) => ai.applyReviewComment(instructionsFor, instructions)}
          />
        )
      )}
    </>
  );
}
