import type { GistComment } from "@/shared/github";
import {
  Agent,
  isOpenAIResponsesRawModelStreamEvent,
  OpenAIResponsesModel,
  run,
  webSearchTool,
  type Tool,
} from "@openai/agents";
import { JSONParser, type ParsedElementInfo } from "@streamparser/json";
import type { AgentMode } from "../model/modes";
import { agentModelAtom } from "../settings/modelSettings";
import { answerSchema, createAnswerParser, type Answer } from "./answer";
import { createOpenAIClient } from "./client";
import { referencesAsContext, userCommentsAsContext, type AdditionalReference } from "./context";
import { editTool } from "./edit";
import { gistTools } from "./gistTools";
import {
  customInstructionsAsContext,
  getAgentInstructions,
  type Capabilities,
  type CustomInstructions,
} from "./instructions";
import { RESEARCH_TOOL, researchTool } from "./research";
import { createReviewParser, REVIEW_TOOL, reviewTool, type Review } from "./review";

/** The document (or selection) that the user is asking the agent about. */
export interface AgentDocument {
  path: string;
  title?: string;
  content: string;
  isSelection: boolean;
}

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
  /** Starts a research task (which is only available when this is provided). */
  onResearch?: (topic: string) => Promise<void>;
}

/** Creates a parser for streaming JSON, which ignores any invalid JSON (e.g. a truncated response). */
function createJsonParser(onValue: (info: ParsedElementInfo) => void) {
  const parser = new JSONParser({ emitPartialTokens: true, emitPartialValues: true });
  parser.onValue = onValue;
  return (chunk: string) => {
    try {
      parser.write(chunk);
    } catch (error) {
      console.warn("Failed to parse the agent's streaming response:", error);
    }
  };
}

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * Responds to a request, by answering it, editing or reviewing the current document, or starting
 * a research task (depending on the mode, and what the agent decides). Returns the response's
 * ID, which allows continuing the conversation.
 */
export async function runAgent(request: AgentRequest) {
  const { mode, document, signal } = request;
  const capabilities: Capabilities = {
    canEdit: !!document && (mode === "auto" || mode === "edit"),
    canReview: !!document && (mode === "auto" || mode === "review"),
    canResearch: mode === "auto" && !!request.onResearch,
    mode: mode === "auto" ? undefined : mode,
  };

  const tools: Tool[] = [webSearchTool(), ...gistTools];
  if (document && capabilities.canEdit) tools.push(editTool(document, request.onEdit));
  if (capabilities.canReview) tools.push(reviewTool);
  if (request.onResearch && capabilities.canResearch) tools.push(researchTool(request.onResearch));

  const agent = new Agent({
    name: "GistPad",
    instructions: getAgentInstructions(capabilities),
    model: new OpenAIResponsesModel(createOpenAIClient(), agentModelAtom.get()),
    modelSettings: {
      // Its reasoning is summarized as it streams in, which is displayed as its progress
      reasoning: { summary: "auto" },
      text: { verbosity: "low" },
    },
    outputType: answerSchema,
    tools,
    // Reviews are displayed as they stream in, and research runs in the background, so
    // there's nothing more for the agent to say after calling those tools.
    toolUseBehavior: { stopAtToolNames: [REVIEW_TOOL, RESEARCH_TOOL] },
  });

  const documentContext =
    document &&
    `<current_document path="${escapeAttribute(document.path)}"${
      document.title ? ` title="${escapeAttribute(document.title)}"` : ""
    }${document.isSelection ? ' selection="true"' : ""}>\n${document.content}\n</current_document>`;

  const input = [
    `<request>${request.prompt}</request>`,
    documentContext,
    userCommentsAsContext(request.userComments),
    referencesAsContext(request.references),
    customInstructionsAsContext(request.instructions, capabilities),
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = await run(agent, input, {
    stream: true,
    signal,
    previousResponseId: request.previousResponseId,
  });

  // Answers stream in as messages, and reviews stream in as the review tool's arguments
  let message: { id: string; write: (chunk: string) => void } | undefined;
  let reviewCall: { id?: string; write: (chunk: string) => void } | undefined;
  let reasoningSummary = "";

  for await (const event of stream) {
    if (signal.aborted) break;
    if (!isOpenAIResponsesRawModelStreamEvent(event)) continue;

    const data = event.data.event;
    switch (data.type) {
      case "response.output_item.added": {
        const { item } = data;
        if (item.type === "message") {
          message = { id: item.id, write: createJsonParser(createAnswerParser(request.onAnswer)) };
        } else if (item.type === "apply_patch_call") {
          request.onEditStart();
        } else if (item.type === "function_call" && item.name === REVIEW_TOOL) {
          request.onReviewStart();
          reviewCall = {
            id: item.id,
            write: createJsonParser(createReviewParser(request.onReview)),
          };
        }
        break;
      }
      case "response.output_text.delta":
        if (message && data.item_id === message.id) message.write(data.delta);
        break;
      case "response.function_call_arguments.delta":
        if (reviewCall && data.item_id === reviewCall.id) reviewCall.write(data.delta);
        break;
      case "response.reasoning_summary_part.added":
        reasoningSummary = "";
        break;
      case "response.reasoning_summary_text.delta":
        reasoningSummary += data.delta;
        request.onProgress({ reasoningSummary });
        break;
      case "response.web_search_call.in_progress":
        request.onProgress({ isWebSearching: true });
        break;
      case "response.web_search_call.completed":
        request.onProgress({ isWebSearching: false });
        break;
    }
  }

  if (signal.aborted) return null;

  await stream.completed;
  return stream.lastResponseId ?? null;
}
