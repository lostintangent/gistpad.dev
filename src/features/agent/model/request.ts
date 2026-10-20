import type { GistComment } from "@/shared/github";
import type { Answer } from "../ask/answer";
import type { Review } from "../review/review";
import {
  documentAsContext,
  referencesAsContext,
  userCommentsAsContext,
  type AdditionalReference,
  type AgentDocument,
} from "./context";
import {
  customInstructionsAsContext,
  getAgentInstructions,
  type CustomInstructions,
} from "./instructions";
import type { AgentMode, Capabilities } from "./modes";

// A request to the agent (i.e. a command that the user, or the voice assistant, ran), which a runtime
// fulfils by prompting a model, and then reports its response (as it streams in) via the callbacks.

/** What the agent is doing, while it's working on a response. */
export interface AgentProgress {
  reasoningSummary: string | null;
  isWebSearching: boolean;
}

export interface AgentRequest {
  /** The kind of response that the user asked for, where "auto" lets the agent decide. */
  mode: Exclude<AgentMode, "research"> | "auto";
  prompt: string;
  document?: AgentDocument;
  instructions: CustomInstructions;
  references?: AdditionalReference[];
  userComments?: GistComment[];
  /** Continues a previous conversation (e.g. to refine an edit, or ask a follow-up question). */
  previousResponseId?: string;
  signal: AbortSignal;

  onProgress: (progress: Partial<AgentProgress>) => void;
  /** Called as an answer streams in (once it has some text). */
  onAnswer: (answer: Answer) => void;
  /** Called when the agent starts writing an edit (before it's applied). */
  onEditStart: () => void;
  /** Applies an edit to the document, by replacing its content (or selection). */
  onEdit: (content: string) => Promise<void>;
  /** Called when the agent starts writing a review (whose changes then stream in). */
  onReviewStart: () => void;
  onReview: (changes: Partial<Review>) => void;
  /** Called once the review is complete (while the agent finishes responding). */
  onReviewEnd: () => void;
  /** Starts a research task (which is only available when this is provided). */
  onResearch?: (topic: string) => Promise<void>;
}

/** The agent's prompt for a request: what it can do, its instructions, and its input (with the request's context). */
export function getAgentPrompt(request: AgentRequest) {
  const { mode, document } = request;
  const capabilities: Capabilities = {
    canEdit: !!document && (mode === "auto" || mode === "edit"),
    canReview: !!document && (mode === "auto" || mode === "review"),
    canResearch: mode === "auto" && !!request.onResearch,
    mode: mode === "auto" ? undefined : mode,
  };

  const input = [
    `<request>${request.prompt}</request>`,
    documentAsContext(document),
    userCommentsAsContext(request.userComments),
    referencesAsContext(request.references),
    customInstructionsAsContext(request.instructions, capabilities),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { capabilities, instructions: getAgentInstructions(capabilities), input };
}
