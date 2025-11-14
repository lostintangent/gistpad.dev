import { Tool } from "../types";

export default {
    definition: {
        name: "delete_gist",
        description:
            "Delete the currently viewed gist or gist file (when the gist has multiple files).",
    },
    handler: (_, { deleteGist }) => deleteGist(),
    isEditTool: true,
} as Tool<void>;
