import { closeComments } from "@/features/comments/store";
import { useIsMobile } from "@/shared/useMediaQuery";
import type { ReviewComment } from "../openai";
import { updateAgentResult } from "../model/store";
import { useAgent } from "../model/useAgent";

/** The commands that a review offers: following it up, regenerating it, and applying its comments. */
export function useReviewCommands() {
  const { run } = useAgent();
  const isMobile = useIsMobile();

  return {
    followUp: (topic: string) => run(topic, "review"),

    /** Regenerates the review's comments (optionally, with additional context). */
    retry: (input?: string) =>
      run(
        `Please generate a new set of comments based on the same request as the previous review${input ? `, and also consider this additional context: "${input}"` : ""}`,
        "review",
      ),

    /** Applies a comment, by asking the agent to edit the file accordingly. */
    apply: async (comment: ReviewComment, input?: string) => {
      updateAgentResult("review", { applyingCommentId: comment.id });

      const isApplied =
        (await run(
          `Make the following change to the document: ${comment.applyPrompt}

The following provides some additional context about the change that I'd like to make:
${JSON.stringify({ feedback: comment.comment, referencedText: comment.referencedText || undefined, replaceWith: comment.replaceWith || undefined, insertAfter: comment.insertAfter || undefined }, null, 2)}

${input ? `Additionally, here's some extra clarification about how I'd like this change made: "${input}"` : ""}

It's important that you don't simply add the comment text to the document, but rather that you take the time to think about how to best update the document based on your comment (e.g. inserting an item into a list, moving content around, updating a sentence, etc.). Additionally, don't add a commment into the document about the change, simply make the change.`,
          "edit",
        )) === "edit";

      updateAgentResult("review", ({ appliedCommentIds }) => ({
        appliedCommentIds: isApplied ? [...appliedCommentIds, comment.id] : appliedCommentIds,
        applyingCommentId: null,
      }));

      if (isApplied && isMobile) closeComments();
    },
  };
}
