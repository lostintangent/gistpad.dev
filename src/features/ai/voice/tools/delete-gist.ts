import { confirmDeleteFile } from "@/features/gists/dialogs/DeleteGistDialog";
import type { Tool } from "../types";

export default {
  definition: {
    name: "delete_gist",
    description:
      "Delete the currently viewed gist or gist file (when the gist has multiple files).",
  },
  // Deleting requires confirmation, so this only opens the delete dialog
  handler: (_, { doc }) => {
    if (doc.gist) confirmDeleteFile(doc.gist, doc.filename);
  },
  isEditTool: true,
} as Tool<void>;
