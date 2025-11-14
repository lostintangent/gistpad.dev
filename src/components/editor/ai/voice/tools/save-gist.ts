import { Tool } from "../types";

export default {
    definition: {
        name: "save_gist",
        description:
            "Save the currently edited gist or file. Only do this if the user explicitly asks. Otherwise, make edits using the edit_gist function.",
    },
    handler: (_, { saveGist }) => saveGist(),
    isEditTool: true,
} as Tool<void>;
