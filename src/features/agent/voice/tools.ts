import { closeComments, openComments } from "@/features/comments/store";
import { EDITOR_MODES, type EditorMode } from "@/features/editor/mode";
import { openFile, type ActiveFile } from "@/features/files/file";
import { deleteGistDialog } from "@/features/gists/dialogs/DeleteGistDialog";
import { toMarkdownFilename } from "@/shared/github";
import { uploadImage } from "@/shared/supabase";
import { toast } from "sonner";
import { z } from "zod";
import type { AgentMode } from "../model/modes";
import { playChime } from "../shared/chime";

/** The (latest) state and actions of the editor, when a voice tool is called. */
export interface VoiceToolContext {
  file: ActiveFile;
  /** Runs an agent command, and throws if it doesn't complete (e.g. because it failed). */
  runCommand: (command: string, mode: AgentMode) => Promise<void>;
  addFile: (filename: string, content?: string) => Promise<void>;
  createGist: (description: string, content?: string) => Promise<void>;
  save: () => Promise<void>;
  setEditorMode: (mode: EditorMode) => void;
  muteMicrophone: () => void;
  endConversation: () => void;
}

/** A message for the assistant (about the tool call), and whether it should respond to it. */
type VoiceToolResult = string | void | { successMessage?: string; requestResponse?: boolean };

export interface VoiceTool<Parameters extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  parameters?: Parameters;
  /** Whether the tool edits the user's gists (so it's only available if they can edit the file). */
  isEditTool?: boolean;
  /** Performs the tool call, and throws if it fails (so the assistant can let the user know). */
  handler(
    args: z.infer<Parameters>,
    context: VoiceToolContext,
  ): VoiceToolResult | Promise<VoiceToolResult>;
}

/** Defines a tool (whose handler's arguments are inferred from its parameters). */
const voiceTool = <Parameters extends z.ZodObject>(tool: VoiceTool<Parameters>) => tool;

/** The tools that the voice assistant can call. */
const tools: VoiceTool[] = [
  voiceTool({
    name: "end_conversation",
    description: "End the current voice conversation when explicitly requested by the user.",
    handler: (_, { endConversation }) => endConversation(),
  }),
  voiceTool({
    name: "mute_microphone",
    description: "Mute the user's microphone when they explicitly ask to mute.",
    handler: (_, { muteMicrophone }) => muteMicrophone(),
  }),
  voiceTool({
    name: "open_gist_file",
    description:
      "Open a specific file in the current gist when explicitly requested by the user. It's important that you only open files that are specifically part of the current gist. Do not open any other files. If the user asks you to open a file that doesn't exist, then kindle tell them it doesn't exist.",
    parameters: z.object({
      filename: z.string().describe("The name of the file to open in the current gist."),
    }),
    handler: ({ filename }, { file }) => {
      openFile(file.gistId, toMarkdownFilename(filename));
    },
  }),
  voiceTool({
    name: "open_url",
    description: "Open a URL in a new browser tab when explicitly requested by the user.",
    parameters: z.object({
      url: z.string().describe("The URL to open in a new browser tab."),
    }),
    handler: ({ url }) => {
      window.open(url, "_blank");
      return "URL successfully opened in a new tab.";
    },
  }),
  voiceTool({
    name: "create_gist",
    description: "Create a new gist with a specific description and content.",
    parameters: z.object({
      description: z
        .string()
        .describe("The short title of the gist, that briefly describes its purpose and content."),
      content: z.string().describe("The initial content for the newly created gist."),
    }),
    handler: async ({ description, content }, { createGist }) => {
      await createGist(description, content);
      await playChime();
    },
  }),
  voiceTool({
    name: "change_view_mode",
    description:
      "Switch between the various view modes for the current document: edit, preview, and split (edit + preview).",
    parameters: z.object({
      mode: z.enum(EDITOR_MODES).describe("The view mode to switch to."),
    }),
    handler: ({ mode }, { setEditorMode }) => {
      // Split mode is displayed as preview mode on mobile
      setEditorMode(mode);
      return `Switched to ${mode} mode.`;
    },
  }),
  voiceTool({
    name: "edit_gist",
    description:
      "Edit the contents of the currently viewed gist. And if you need to add a reference/link to another file in the gist, you can do so using wiki link syntax (e.g. [[foo]]).",
    parameters: z.object({
      request: z
        .string()
        .describe("A natural language description of the edits to make to the current document."),
    }),
    handler: ({ request }, { runCommand }) => runCommand(request, "edit"),
    isEditTool: true,
  }),
  voiceTool({
    name: "generate_image",
    description:
      "Generate an image URL based on a prompt. And then after you receive the resulting URL, insert it into the document by calling edit_gist with the necessary markdown image link (including the entire document comments + your edits). Only ever generate one image at a time, and so if the user asks for multiple images, then generate one, and then wait to recieve confirmation that it succeeded before generating the next one.",
    parameters: z.object({
      prompt: z.string().describe("The full prompt to use for generating the image."),
      summary: z
        .string()
        .describe("A short description (3-5 words) that summarizes the image being generated."),
    }),
    handler: async ({ prompt, summary }, { file }) => {
      const generate = async () => {
        const { generateImage } = await import("../openai");
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
  }),
  voiceTool({
    name: "add_gist_file",
    description: "Add a new file to the currently viewed gist.",
    parameters: z.object({
      filename: z
        .string()
        .describe(
          "The name of the file to add to the current gist. This value must be a valid filename, and therefore, exclude things like emojis, slashes, etc.",
        ),
      content: z.string().describe("The content of the file to add to the current gist."),
      userRequested: z
        .boolean()
        .describe(
          "Indicates whether this edit is being made in response to a direct user request, or whether its an edit being made based on the instructions of the conversation.",
        ),
    }),
    handler: async ({ filename, content, userRequested }, { addFile }) => {
      await addFile(toMarkdownFilename(filename), content);

      if (userRequested) await playChime();
      return {
        successMessage: `We are now viewing the "${filename}" file, which is included in the gist.`,
        requestResponse: !userRequested,
      };
    },
    isEditTool: true,
  }),
  voiceTool({
    name: "delete_gist",
    description:
      "Delete the currently viewed gist or gist file (when the gist has multiple files).",
    // Deleting requires confirmation, so this only opens the delete dialog
    handler: (_, { file }) => {
      if (file.gist) deleteGistDialog.openWithPayload({ gist: file.gist, filename: file.filename });
    },
    isEditTool: true,
  }),
  voiceTool({
    name: "generate_review_comments",
    description:
      "Generate review feedback/thoughts/comments/suggestions about the current document. Only call this when the user explicitly asks for 'comments' or a 'review' about a specific topic.",
    parameters: z.object({
      topic: z
        .string()
        .describe(
          "The topic that the user wants review comments/feedback about, including any context or details that are necessary to fulfill the request.",
        ),
    }),
    handler: ({ topic }, { runCommand }) => runCommand(topic, "review"),
  }),
  voiceTool({
    name: "perform_research",
    description:
      "Kick off an asynchronous research task about a specific topic. Only call this when the user explicitly asks for 'research' about a specific topic.",
    parameters: z.object({
      topic: z
        .string()
        .describe(
          "The topic that should be researched asynchronously, along with any details about the content and/or format you'd like generated.",
        ),
    }),
    handler: ({ topic }, { runCommand }) => runCommand(topic, "research"),
  }),
  voiceTool({
    name: "save_gist",
    description:
      "Save the currently edited gist or file. Only do this if the user explicitly asks. Otherwise, make edits using the edit_gist function.",
    handler: (_, { save }) => save(),
    isEditTool: true,
  }),
  voiceTool({
    name: "toggle_comment_sidebar",
    description: "Show or hide the comment sidebar.",
    parameters: z.object({
      visible: z.boolean().describe("Whether the comment sidebar should be visible."),
    }),
    handler: ({ visible }) => {
      if (visible) openComments();
      else closeComments();
      return `Comment sidebar ${visible ? "opened" : "closed"}.`;
    },
  }),
];

/** The tools that the voice assistant can call (which only includes edit tools, if the user can edit). */
export const getVoiceTools = ({ canEdit }: { canEdit: boolean }) =>
  tools.filter((tool) => canEdit || !tool.isEditTool);
