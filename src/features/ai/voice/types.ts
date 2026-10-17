import type { GistDocument } from "@/features/editor/document";
import type { EditorMode } from "@/router";
import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";
import type { AiMode } from "../useAiCommands";

interface ToolResult {
  successMessage?: string;
  requestResponse?: boolean;
}

/** The (latest) state and actions of the editor, when a voice tool is called. */
export interface VoiceToolContext {
  doc: GistDocument;
  /** Runs an AI command, and throws if it doesn't complete (e.g. because it failed). */
  runCommand: (command: string, mode: AiMode) => Promise<void>;
  openFile: (filename: string) => Promise<void>;
  addFile: (filename: string, content?: string) => Promise<void>;
  createGist: (description: string, content?: string) => Promise<void>;
  save: () => Promise<void>;
  setEditorMode: (mode: EditorMode) => void;
  muteMicrophone: () => void;
  endConversation: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each tool has its own arguments
export interface Tool<T = any> {
  definition: RealtimeFunctionTool;
  /** Performs the tool call, and throws if it fails (so the assistant can let the user know). */
  handler: (
    args: T,
    context: VoiceToolContext,
  ) => Promise<ToolResult | void | string> | ToolResult | void | string;
  isEditTool?: boolean;
}
