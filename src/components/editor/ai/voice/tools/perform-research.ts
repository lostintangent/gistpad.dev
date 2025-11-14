import { Tool } from "../types";

export default {
  definition: {
    name: "perform_research",
    description:
      "Kick off an asynchronous research task about a specific topic. Only call this when the user explicitly asks for 'research' about a specific topic.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The topic that should be researched asynchronously, along with any details about the content and/or format you'd like generated.",
        },
      },
      required: ["topic"],
    },
  },
  handler: ({ topic }, { performResearch }) => performResearch(topic),
} as Tool<{ topic: string }>;
