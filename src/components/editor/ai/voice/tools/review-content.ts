import { Tool } from "../types";

export default {
  definition: {
    name: "generate_review_comments",
    description:
      "Generate review feedback/thoughts/comments/suggestions about the current document. Only call this when the user explicitly asks for 'comments' or a 'review' about a specific topic.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The topic that the user wants review comments/feedback about, including any context or details that are necessary to fulfill the request.",
        },
      },
      required: ["topic"],
    },
  },
  handler: ({ topic }, { reviewContent }) => reviewContent(topic),
} as Tool<{ topic: string }>;
