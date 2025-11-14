import { Tool } from "../types";

export default {
    definition: {
        name: "open_url",
        description:
            "Open a URL in a new browser tab when explicitly requested by the user.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The URL to open in a new browser tab.",
                },
            },
            required: ["url"],
        },
    },
    handler: ({ url }) => {
        window.open(url, "_blank");
        return "URL successfully opened in a new tab.";
    },
} as Tool<{ url: string }>;