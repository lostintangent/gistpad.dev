import type { ActiveFile } from "@/features/files/file";
import { toMarkdownFilename } from "@/shared/github";
import { uploadImage } from "@/shared/supabase";
import { toast } from "sonner";
import { z } from "zod";
import { runCommandTool } from "../model/commandCatalog";
import { gistTools } from "../model/gistTools";
import type { AgentMode } from "../model/modes";
import type { AgentTool } from "../model/tools";
import { playChime } from "../shared/chime";

// The voice assistant's tools are the agent's (reading gists, and running the app's commands), plus
// the ones that carry content (e.g. a new file's) or need the agent's results (e.g. an edit's).

/** The (latest) state and actions of the editor, when a talk tool is called. */
export interface TalkToolContext {
  file: ActiveFile;
  /**
   * Runs an agent command, and describes its result for the assistant (e.g. the answer that's
   * displayed), which only asks it to respond when the result isn't what it asked for (e.g. the
   * agent asked for clarification). Throws if it doesn't complete (e.g. because it failed).
   */
  runCommand: (command: string, mode: AgentMode) => Promise<TalkToolResult>;
  addFile: (filename: string, content?: string) => Promise<void>;
  createGist: (description: string, content?: string) => Promise<void>;
}

/** A message for the assistant (about the tool call), and whether it should respond to it. */
export type TalkToolResult = string | void | { successMessage?: string; requestResponse?: boolean };

export interface TalkTool<Parameters extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  parameters?: Parameters;
  /**
   * Whether the tool changes the user's gist (beyond drafting edits), so it can't be called for
   * other people's gists (which can only be forked).
   */
  requiresOwnership?: boolean;
  /** Performs the tool call, and throws if it fails (so the assistant can let the user know). */
  handler(
    args: z.infer<Parameters>,
    context: TalkToolContext,
  ): TalkToolResult | Promise<TalkToolResult>;
}

/** Defines a tool (whose handler's arguments are inferred from its parameters). */
const talkTool = <Parameters extends z.ZodObject>(tool: TalkTool<Parameters>) => tool;

/** Adapts one of the agent's tools, and asks the assistant to respond with its result. */
const fromAgentTool = ({ execute, ...tool }: AgentTool) =>
  talkTool({
    ...tool,
    handler: async (args) => ({ successMessage: await execute(args), requestResponse: true }),
  });

/** The tools that the voice assistant can call. */
export const talkTools: TalkTool[] = [
  ...gistTools.map(fromAgentTool),
  // (Running a command speaks for itself, so the assistant isn't asked to respond to it)
  talkTool({ ...runCommandTool, handler: (args) => runCommandTool.execute(args) }),
  talkTool({
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
  talkTool({
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
  talkTool({
    name: "edit_gist",
    description:
      "Edit the contents of the currently viewed gist. And if you need to add a reference/link to another file in the gist, you can do so using wiki link syntax (e.g. [[foo]]).",
    parameters: z.object({
      request: z
        .string()
        .describe("A natural language description of the edits to make to the current document."),
    }),
    handler: ({ request }, { runCommand }) => runCommand(request, "edit"),
  }),
  talkTool({
    name: "generate_image",
    description:
      "Generate an image based on a prompt, and get its URL (which can then be inserted into the document by calling edit_gist).",
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
    requiresOwnership: true,
  }),
  talkTool({
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
    requiresOwnership: true,
  }),
  talkTool({
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
  talkTool({
    name: "show_answer",
    description:
      "Show the user a written answer (e.g. a table, list, or summary), which is displayed alongside the document. Only call this when the user asks to see something, as opposed to just hearing it.",
    parameters: z.object({
      question: z
        .string()
        .describe(
          "The question (or request) that the answer should address, including any context from the conversation that's necessary to answer it.",
        ),
    }),
    handler: ({ question }, { runCommand }) => runCommand(question, "ask"),
  }),
  talkTool({
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
];
