import { Tool } from "../types";

export default {
    definition: {
        name: "edit_gist",
        description:
            "Edit the contents of the currently viewed gist. And if you need to add a reference/link to another file in the gist, you can do so using wiki link syntax (e.g. [[foo]]).",
        parameters: {
            type: "object",
            properties: {
                request: {
                    type: "string",
                    description:
                        "A natural language description of the edits to make to the current document.",
                },
            },
            required: ["request"],
        },
    },
    handler: async ({ request }, { editContent }) => editContent(request),
    isEditTool: true,
} as Tool<{
    request: string;
}>;
