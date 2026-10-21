import type { TalkTool, TalkToolContext } from "./tools";

/**
 * A voice conversation with the assistant, as the UI sees and controls it (see `useTalkSession`).
 * It runs over a talk connection (below), which a runtime opens.
 */
export interface TalkSession {
  isActive: boolean;
  isConnecting: boolean;
  isMicMuted: boolean;

  isAssistantSpeaking: boolean;
  // Whether the assistant has yet to respond to a (typed) command.
  isAwaitingResponse: boolean;

  // Starts a session (or ends the current one).
  start: VoidFunction;
  end: VoidFunction;
  toggleMute: VoidFunction;

  // Sends a (typed) command to the assistant, interrupting it if it's speaking.
  sendCommand: (command: string) => void;
}

/**
 * The connection that a session runs over: a realtime voice conversation with the assistant
 * which a runtime opens (with one of the voices below), so that the session doesn't depend on any SDK.
 */
export interface TalkConnection {
  // Sends a (typed) message to the assistant, which it responds to.
  sendMessage: (text: string) => void;

  // Shares context with the assistant (e.g. the document), without asking it to respond.
  shareContext: (text: string) => void;

  // Asks the assistant to respond (e.g. to start the conversation).
  respond: VoidFunction;

  // Stops the assistant's current response (e.g. while it's speaking).
  interrupt: VoidFunction;

  mute: (isMuted: boolean) => void;
  close: VoidFunction;
}

export interface TalkConnectionOptions {
  instructions: string;
  voice: string;
  tools: TalkTool[];

  // Returns the latest state of the editor (when a tool is called).
  getToolContext: () => TalkToolContext;

  // Called when the assistant starts, and stops, speaking.
  onSpeakingChange: (isSpeaking: boolean) => void;

  // Called when the assistant starts responding (which may be by calling a tool, before it speaks).
  onResponseStart: VoidFunction;
}

// The voices that the assistant can talk with (configured by the "talk" settings).
export const VOICES = [
  { name: "alloy", description: "Easygoing and versatile" },
  { name: "ash", description: "Composed and direct" },
  { name: "ballad", description: "Confident and optimistic" },
  { name: "coral", description: "Open and upbeat" },
  { name: "echo", description: "Cheerful and candid" },
  { name: "sage", description: "Savvy and relaxed" },
  { name: "shimmer", description: "Calm and affirming" },
  { name: "verse", description: "Bright and inquisitive" },
];

export const DEFAULT_VOICE = "alloy";
