import { Tool } from "../types";

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
    handler: ({ visible }, { setCommentSidebarOpen }) => {
        setCommentSidebarOpen(visible);
        return `Comment sidebar ${visible ? "opened" : "closed"}.`;
    },
} as Tool<{ visible: boolean }>;
