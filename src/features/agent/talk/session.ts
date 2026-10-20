import type { TalkTool, TalkToolContext } from "./tools";

// A talk session is a realtime voice conversation with the assistant, which a runtime implements
// (and which the conversation hook drives, without depending on any SDK).

export interface TalkSessionOptions {
  instructions: string;
  voice: string;
  tools: TalkTool[];
  /** Returns the latest state of the editor (when a tool is called). */
  getToolContext: () => TalkToolContext;
}

/** What happens during the conversation (which the UI reflects). */
export interface TalkSessionEvents {
  onAssistantSpeaking: (isSpeaking: boolean) => void;
  onUserSpeaking: (isSpeaking: boolean) => void;
  /** Called when the assistant starts calling a tool (i.e. it's responding). */
  onToolStart: () => void;
}

export interface TalkSession {
  /** Shares context with the assistant (e.g. the document), without asking it to respond. */
  shareContext: (text: string) => void;
  /** Asks the assistant to respond (e.g. to start the conversation). */
  respond: () => void;
  /** Sends a (typed) message to the assistant, which it responds to. */
  sendMessage: (text: string) => void;
  /** Stops the assistant's current response (e.g. while it's speaking). */
  interrupt: () => void;
  mute: (isMuted: boolean) => void;
  /** Subscribes to the conversation's events, and returns a function that unsubscribes. */
  subscribe: (events: TalkSessionEvents) => () => void;
  /** Ends the conversation (and stops using the microphone). */
  close: () => void;
}
