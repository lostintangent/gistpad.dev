import { closeComments, openComments } from "@/features/comments/store";
import { openFile, type ActiveFile } from "@/features/files/file";
import { deleteGistDialog } from "@/features/gists/dialogs/DeleteGistDialog";
import type { EditorMode } from "@/features/editor/mode";
import { toMarkdownFilename } from "@/shared/github";
import { uploadImage } from "@/shared/supabase";
import { playAiChime } from "../chime";
import { toast } from "sonner";
import type { AiMode } from "../commands";

/** The (latest) state and actions of the editor, when a voice tool is called. */
export interface VoiceToolContext {
  file: ActiveFile;
  /** Runs an AI command, and throws if it doesn't complete (e.g. because it failed). */
  runCommand: (command: string, mode: AiMode) => Promise<void>;
  addFile: (filename: string, content?: string) => Promise<void>;
  createGist: (description: string, content?: string) => Promise<void>;
  save: () => Promise<void>;
  setEditorMode: (mode: EditorMode) => void;
  muteMicrophone: () => void;
  endConversation: () => void;
}

/** A message for the assistant (about the tool call), and whether it should respond to it. */
type ToolResult = string | void | { successMessage?: string; requestResponse?: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each tool has its own arguments
interface Tool<Args = any> {
  name: string;
  description: string;
  /** The JSON schema of the tool's arguments (if it has any). */
  parameters?: object;
  /** Whether the tool edits the user's gists (so it's only available if they can edit the file). */
  isEditTool?: boolean;
  /** Performs the tool call, and throws if it fails (so the assistant can let the user know). */
  handler: (args: Args, context: VoiceToolContext) => ToolResult | Promise<ToolResult>;
}

/** The tools that the voice assistant can call. */
const tools: Tool[] = [
  {
    name: "end_conversation",
    description: "End the current voice conversation when explicitly requested by the user.",
    handler: (_, { endConversation }) => endConversation(),
  },
  {
    name: "mute_microphone",
    description: "Mute the user's microphone when they explicitly ask to mute.",
    handler: (_, { muteMicrophone }) => muteMicrophone(),
  },
  {
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
    handler: ({ filename }, { file }) => {
      openFile(file.gistId, toMarkdownFilename(filename));
    },
  } satisfies Tool<{ filename: string }>,
  {
    name: "open_url",
    description: "Open a URL in a new browser tab when explicitly requested by the user.",
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
    handler: ({ url }) => {
      window.open(url, "_blank");
      return "URL successfully opened in a new tab.";
    },
  } satisfies Tool<{ url: string }>,
  {
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
    handler: async ({ description, content }, { createGist }) => {
      await createGist(description, content);
      await playAiChime();
    },
  } satisfies Tool<{ description: string; content: string }>,
  {
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
    handler: ({ mode }, { setEditorMode }) => {
      // Split mode is displayed as preview mode on mobile
      setEditorMode(mode);
      return `Switched to ${mode} mode.`;
    },
  } satisfies Tool<{ mode: EditorMode }>,
  {
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
    handler: ({ request }, { runCommand }) => runCommand(request, "edit"),
    isEditTool: true,
  } satisfies Tool<{ request: string }>,
  {
    name: "generate_image",
    description:
      "Generate an image URL based on a prompt. And then after you receive the resulting URL, insert it into the document by calling edit_gist with the necessary markdown image link (including the entire document comments + your edits). Only ever generate one image at a time, and so if the user asks for multiple images, then generate one, and then wait to recieve confirmation that it succeeded before generating the next one.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The full prompt to use for generating the image.",
        },
        summary: {
          type: "string",
          description: "A short description (3-5 words) that summarizes the image being generated.",
        },
      },
      required: ["prompt", "summary"],
    },
    handler: async ({ prompt, summary }, { file }) => {
      const generate = async () => {
        const { generateImage } = await import("../agents");
        return uploadImage(file.gistId!, await generateImage(prompt));
      };

      const imageUrl = await toast
        .promise(generate(), {
          loading: `Generating image ("${summary}")...`,
          error: "Failed to generate the image.",
        })
        .unwrap();

      return { successMessage: `Image generated: ${imageUrl}.`, requestResponse: true };
    },
    isEditTool: true,
  } satisfies Tool<{ prompt: string; summary: string }>,
  {
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
    handler: async ({ filename, content, userRequested }, { addFile }) => {
      await addFile(toMarkdownFilename(filename), content);

      if (userRequested) await playAiChime();
      return {
        successMessage: `We are now viewing the "${filename}" file, which is included in the gist.`,
        requestResponse: !userRequested,
      };
    },
    isEditTool: true,
  } satisfies Tool<{ filename: string; content: string; userRequested: boolean }>,
  {
    name: "delete_gist",
    description:
      "Delete the currently viewed gist or gist file (when the gist has multiple files).",
    // Deleting requires confirmation, so this only opens the delete dialog
    handler: (_, { file }) => {
      if (file.gist) deleteGistDialog.openWithPayload({ gist: file.gist, filename: file.filename });
    },
    isEditTool: true,
  },
  {
    name: "generate_review_comments",
    description:
      "Generate review feedback/thoughts/comments/suggestions about the current document. Only call this when the user explicitly asks for 'comments' or a 'review' about a specific topic.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The topic that the user wants review comments/feedback about, including any context or details that are necessary to fulfill the request.",
        },
      },
      required: ["topic"],
    },
    handler: ({ topic }, { runCommand }) => runCommand(topic, "review"),
  } satisfies Tool<{ topic: string }>,
  {
    name: "perform_research",
    description:
      "Kick off an asynchronous research task about a specific topic. Only call this when the user explicitly asks for 'research' about a specific topic.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The topic that should be researched asynchronously, along with any details about the content and/or format you'd like generated.",
        },
      },
      required: ["topic"],
    },
    handler: ({ topic }, { runCommand }) => runCommand(topic, "research"),
  } satisfies Tool<{ topic: string }>,
  {
    name: "save_gist",
    description:
      "Save the currently edited gist or file. Only do this if the user explicitly asks. Otherwise, make edits using the edit_gist function.",
    handler: (_, { save }) => save(),
    isEditTool: true,
  },
  {
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
    handler: ({ visible }) => {
      if (visible) openComments();
      else closeComments();
      return `Comment sidebar ${visible ? "opened" : "closed"}.`;
    },
  } satisfies Tool<{ visible: boolean }>,
];

export const getToolHandler = (name: string) => tools.find((tool) => tool.name === name)?.handler;

/** The tools that the voice assistant can call (which only includes edit tools, if the user can edit). */
export const getToolDefinitions = ({ canEdit }: { canEdit: boolean }) =>
  tools
    .filter((tool) => canEdit || !tool.isEditTool)
    .map(({ name, description, parameters }) => ({
      type: "function",
      name,
      description,
      parameters,
    }));
