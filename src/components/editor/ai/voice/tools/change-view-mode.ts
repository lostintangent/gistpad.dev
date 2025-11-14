import { Tool } from "../types";

export default {
    definition: {
        name: "change_view_mode",
        description:
            "Switch between the various view modes for the current document: edit, preview, and split (edit + preview).",
        parameters: {
            type: "object",
            properties: {
                mode: {
                    type: "string",
                    description: "The view mode to switch to.",
                    enum: ["edit", "preview", "split"],
                },
            },
            required: ["mode"],
        },
    },
    handler: ({ mode }, context) => {
        if (mode === "split" && context.isMobile) {
            mode = "preview";
        }
        
        context.setEditorMode(mode);
        return `Switched to ${mode} mode.`;
    },
} as Tool<{ mode: "edit" | "preview" | "split" }>;
