import { Tool } from "../types";

export default {
    definition: {
        name: "open_gist_file",
        description:
            "Open a specific file in the current gist when explicitly requested by the user. It's important that you only open files that are specifically part of the current gist. Do not open any other files. If the user asks you to open a file that doesn't exist, then kindle tell them it doesn't exist.",
        parameters: {
            type: "object",
            properties: {
                filename: {
                    type: "string",
                    description: "The name of the file to open in the current gist.",
                },
            },
            required: ["filename"],
        },
    },
    handler: ({ filename }, { openFile }) => {
        openFile(
            filename.endsWith(".md") ? filename : `${filename}.md`
        );
    }
} as Tool<{ filename: string }>;