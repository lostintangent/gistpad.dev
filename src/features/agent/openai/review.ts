import { tool } from "@openai/agents";
import type { ParsedElementInfo } from "@streamparser/json";
import { z } from "zod";
import { followUpSchema, removeCitationMarkers, type AgentFollowUp } from "./answer";

const reviewCommentSchema = z.object({
  heading: z.string(),
  comment: z.string(),
  applyPrompt: z.string(),
  referencedText: z.string().nullable(),
  replaceWith: z.string().nullable(),
  insertAfter: z.string().nullable(),
  isExample: z.boolean(),
});

/** A review comment, whose properties stream in as the agent writes it. */
export type ReviewComment = Partial<z.infer<typeof reviewCommentSchema>> & { id: number };

/** A review of the current document, which streams in as the agent calls the review tool. */
export interface Review {
  /** Summarizes the user's request. */
  title: string | null;
  comments: ReviewComment[];
  followUp: AgentFollowUp | null;
}

export const REVIEW_TOOL = "review_document";

export const reviewInstructions = `# Reviewing the document
* Analyze the request and provide the kind of feedback that it asks for. If it explicitly asks for a specific type of feedback (praise, tips, suggestions, etc.) then focus on ONLY that (e.g. don't provide praise when you're asked for advice).
* Provide a concise \`title\` that summarizes the objective of the user's request (prefixed with an emoji).
* Unless the user request's otherwise, be very concise in your comment bodies, favoring 1-2 sentences when possible. However, don't compromise on important detail or nuance.
* When suggesting changes, or providing critique, make sure to match the tone, style, and personality of the existing document. Don't suggest changes that would be inconsistent with the document's existing style.
* When you have general thoughts / feedback / suggestions about the entire document (e.g. a suggestion that would impact multiple places vs. one paragraph), then set referencedText, replaceWith, and insertAfter to \`null\`, since you're commenting on the entire document as opposed to a specific piece of text.
* When you have thoughts / suggestions about a specific piece of text (e.g. a heading, a section, a list item, a table row, a sentence, etc.), then...
    - Always set referencedText to the exact text from the document that you're commenting on
    - If you're suggesting a direct replacement of the referenced text, then set replaceWith to the new text
    - If you're suggesting to insert content after the referenced text (e.g. adding a new list item, creating a new section with a heading), then set insertAfter to the content you want to add
    - Never set both replaceWith and insertAfter for the same comment
    - When you're making a suggestion that would require multiple changes or complex edits, don't use replaceWith or insertAfter, just explain the suggestion in the comment
* CRITICAL: replaceWith and insertAfter are optional, so make sure to set them to \`null\` if you don't have a specific replacement or insertion suggestion. DO NOT set them to a blank or placeholder string (e.g. ".", "/")
* If the user's request specifically asks for concrete/specific suggestions, then make sure to provide comments that suggest specific changes, and set either insertAfter or replaceWith as needed. Otherwise, make general and/or concrete suggestions depending on the request.
* If your suggestion implies multiple changes (as opposed to just one), but you're providing a referencedText / replaceWith / insertAfter, then set isExample to true, so that it's clear the text / replacement / insertion is just an example of a broader change. Otherwise, set it to false.
* When you want to append an item into a list, only reference the last item in the list, as opposed to the entire list. If you want to insert an item into the middle of a list, then reference the item that comes before it.
* For each comment, provide an \`applyPrompt\`, which describes how to edit the document in order to apply the comment (e.g. adding an item to a list, updating a heading/paragraph, moving text from one location to another, etc.).
    - If the user chooses to apply the comment, you'll be asked to make the change with this prompt, so it should be concise but clear, and include all the necessary context to apply the comment.
    - When a comment implies moving text from one location to another, then the prompt should describe the source and destination locations (e.g. "Move the text from the 'Introduction' section to the 'Overview' section").
    - The prompt should start with a verb, and provide a concise directive for how to apply the comment's feedback and referenced text/replacement/insertion. But you don't need to repeat the referenced text or any replacement/insertion (e.g. "Update the title heading to reflect the new suggestion", "Add the referenced text to the favorite items list").
    - The user may choose to apply some comments and not others, so each prompt must be self-contained, and not reference other comments or suggestions.
* Format your comments using markdown, and ensure they follow these style guidelines:
    - For each comment, you MUST ALWAYS generate a \`heading\`, which summarizes the key point / subject of the comment. Be concise and prepend a fun and relevant emoji to it.
    - In the comment, use **bold** and *italic* for emphasis.
    - Use double quotes instead of single quotes when quoting text. However, don't use quotes for referring to the main subject/noun of the comment (use \`\` for that).
    - Use lists and tables as needed, whenever you need to illustrate or show structured data. But don't use lists to provide multiple suggestions for the request (you MUST always use different comments for that).
    - Use inline \`text\` markers when 1) referencing headings in the content, or 2) when referring to the main subject/noun of the comment.
    - If the user asks for a checklist or tasklist, then use the \`- [ ]\` format for the checklist items, as opposed to appending an \`☐\` character to the start of each item.
* CRITICAL: Create distinct/individual comments for each distinct piece of feedback/suggestion you have, even if they are related to the same topic. Do not combine multiple suggestions into a single comment.
* Suggest a \`followUp\` question/topic for the review, following the same guidelines as an answer's follow-up.`;

/** The tool that the agent reviews documents with (whose comments stream into the UI). */
export const reviewTool = (onReviewEnd: () => void) =>
  tool({
    name: REVIEW_TOOL,
    description:
      "Adds a set of review comments to the current document (e.g. feedback, ideas, or suggestions), which are displayed alongside it.",
    parameters: z.object({
      title: z.string().describe("Summarizes the user's request, prefixed with an emoji"),
      comments: z.array(reviewCommentSchema),
      followUp: followUpSchema.nullable(),
    }),
    execute: ({ comments }) => {
      onReviewEnd();
      return `Added ${comments.length} comment${comments.length === 1 ? "" : "s"} to the document.`;
    },
  });

const isCommentProperty = (key: unknown): key is keyof typeof reviewCommentSchema.shape =>
  typeof key === "string" && key in reviewCommentSchema.shape;

/** Parses the review tool's (streaming) arguments into a review, and reports its changes. */
export function createReviewParser(onUpdate: (changes: Partial<Review>) => void) {
  const comments: ReviewComment[] = [];
  const followUp: AgentFollowUp = { question: "", topic: "" };

  return ({ key, value, stack }: ParsedElementInfo) => {
    if (stack.length === 1) {
      if (key === "title") onUpdate({ title: String(value ?? "") });
      else if (key === "followUp" && value === null) onUpdate({ followUp: null });
    } else if (stack.length === 2 && stack[1].key === "followUp") {
      if (key !== "question" && key !== "topic") return;
      followUp[key] = String(value ?? "");
      onUpdate({ followUp: { ...followUp } });
    } else if (stack.length === 3 && stack[1].key === "comments" && isCommentProperty(key)) {
      const index = Number(stack[2].key);
      comments[index] = {
        ...comments[index],
        id: index,
        [key]: key === "comment" ? removeCitationMarkers(String(value)) : value,
      };
      onUpdate({ comments: [...comments] });
    }
  };
}
