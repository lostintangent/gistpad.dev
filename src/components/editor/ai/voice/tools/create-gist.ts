import { playAiChime } from "@/lib/utils";
import { Tool } from "../types";

export default {
    definition: {
        name: "create_gist",
        description: "Create a new gist with a specific description and content.",
        parameters: {
            type: "object",
            properties: {
                description: {
                    type: "string",
                    description:
                        "The short title of the gist, that briefly describes its purpose and content.",
                },
                content: {
                    type: "string",
                    description: "The initial content for the newly created gist.",
                },
            },
            required: ["description", "content"],
        },
    },
    handler: async ({ description, content }, { createGist }) => {
        await createGist(description, content);
        await playAiChime();
    },
} as Tool<{
    description: string;
    content: string;
}>;
