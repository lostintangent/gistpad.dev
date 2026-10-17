import { closeComments, openComments } from "@/features/comments/store";
import type { Tool } from "../types";

export default {
  definition: {
    name: "toggle_comment_sidebar",
    description: "Show or hide the comment sidebar.",
    parameters: {
      type: "object",
      properties: {
        visible: {
          type: "boolean",
          description: "Whether the comment sidebar should be visible.",
        },
      },
      required: ["visible"],
    },
  },
  handler: ({ visible }) => {
    if (visible) openComments();
    else closeComments();
    return `Comment sidebar ${visible ? "opened" : "closed"}.`;
  },
} as Tool<{ visible: boolean }>;
