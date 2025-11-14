import { playAiChime } from "@/lib/utils";
import { Tool } from "../types";

export default {
    definition: {
        name: "add_gist_file",
        description: "Add a new file to the currently viewed gist.",
        parameters: {
            type: "object",
            properties: {
                filename: {
                    type: "string",
                    description:
                        "The name of the file to add to the current gist. This value must be a valid filename, and therefore, exclude things like emojis, slashes, etc.",
                },
                content: {
                    type: "string",
                    description: "The content of the file to add to the current gist.",
                },
                userRequested: {
                    type: "boolean",
                    description:
                        "Indicates whether this edit is being made in response to a direct user request, or whether its an edit being made based on the instructions of the conversation.",
                },
            },
            required: ["filename", "content", "userRequested"],
        },
    },
    handler: async ({ filename, content, userRequested }, { addFile }) => {
        await addFile(
            filename.endsWith(".md") ? filename : `${filename}.md`,
            content
        );

        const successMessage = `We are now viewing the "${filename}" file, which is included in the gist.`;
        if (userRequested) {
            await playAiChime();
            return successMessage;
        }

        return {
            successMessage,
            requestResponse: true,
        };
    },
    isEditTool: true,
} as Tool<{
    filename: string;
    content: string;
    userRequested: boolean;
}>;
