import {
  Agent,
  isOpenAIResponsesRawModelStreamEvent,
  OpenAIResponsesModel,
  run,
  webSearchTool,
  type AgentInputItem,
  type protocol,
  type Tool,
} from "@openai/agents";
import type OpenAI from "openai";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { JSONParser, type ParsedElementInfo } from "@streamparser/json";
import { answerSchema, createAnswerParser } from "../ask/answer";
import { gistTools } from "@/features/gists/tools";
import { getAgentPrompt, type AgentRequest } from "../model/request";
import { researchTool } from "../research/research";
import { createReviewParser, REVIEW_TOOL, reviewTool } from "../review/review";
import { agentModelAtom } from "../settings/modelSettings";
import { createOpenAIClient } from "./client";
import { editTool, toSdkTool } from "./tools";

// Runs the agent with the Agents SDK (and OpenAI's Responses API), and maps the response's stream of
// events to the request's callbacks (e.g. the answer, or review, that's being written).

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

/** Runtime overrides and observations. Callers can inspect usage without changing agent behavior. */
export interface OpenAIAgentRuntime {
  client?: OpenAI;
  model?: string;
  includeGistTools?: boolean;
  includeWebSearch?: boolean;
  maxTurns?: number;
  maxOutputTokens?: number;
  onUsage?: (usage: ResponseUsage | undefined) => void;
  onPatch?: (event: { failed: boolean; output: string }) => void;
  onPrompt?: (prompt: { instructions: string; input: string }) => void;
}

/**
 * Responds to a request, by answering it, editing or reviewing the current document, or starting
 * a research task (depending on the mode, and what the agent decides). Returns the response's
 * ID, which allows continuing the conversation.
 */
export async function runAgent(request: AgentRequest, runtime?: OpenAIAgentRuntime) {
  const { document, signal } = request;
  const { capabilities, instructions, sharedInstructions, context, input } =
    getAgentPrompt(request);
  const messages: AgentInputItem[] = [];
  if (!request.previousResponseId) {
    // This SDK carries developer messages through its provider-specific input item.
    const developerMessage = {
      type: "message",
      role: "developer",
      content: [
        {
          type: "input_text",
          text: sharedInstructions,
          prompt_cache_breakpoint: { mode: "explicit" },
        },
      ],
    } satisfies OpenAI.Responses.EasyInputMessage;
    messages.push({ type: "unknown", providerData: developerMessage });
  }
  const content: protocol.InputText[] = [];
  if (context) {
    content.push({
      type: "input_text",
      text: context,
      promptCacheBreakpoint: { mode: "explicit" },
    });
  }
  content.push({ type: "input_text", text: input });
  messages.push({ role: "user", content });
  runtime?.onPrompt?.({ instructions, input: JSON.stringify(messages, null, 2) });

  const tools: Tool[] = [];
  if (runtime?.includeWebSearch !== false) tools.push(webSearchTool());
  if (runtime?.includeGistTools !== false) {
    tools.push(...gistTools.map((gistTool) => toSdkTool(gistTool)));
  }
  if (document && capabilities.canEdit) {
    tools.push(editTool(document, request.onEdit, runtime?.onPatch));
  }
  if (capabilities.canReview) tools.push(toSdkTool(reviewTool(request.onReviewEnd)));
  if (request.onResearch && capabilities.canResearch) {
    tools.push(toSdkTool(researchTool(request.onResearch)));
  }

  const agent = new Agent({
    name: "GistPad",
    instructions,
    model: new OpenAIResponsesModel(
      runtime?.client ?? createOpenAIClient(),
      runtime?.model ?? agentModelAtom.get(),
    ),
    modelSettings: {
      // Its reasoning is summarized as it streams in, which is displayed as its progress
      reasoning: { summary: "auto" },
      text: { verbosity: "low" },
      maxTokens: runtime?.maxOutputTokens,
      promptCacheOptions: { mode: "implicit" },
    },
    outputType: answerSchema,
    tools,
  });

  const stream = await run(agent, messages, {
    stream: true,
    signal,
    previousResponseId: request.previousResponseId,
    maxTurns: runtime?.maxTurns,
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
      case "response.completed":
      case "response.incomplete":
      case "response.failed":
        runtime?.onUsage?.(data.response.usage);
        break;
    }
  }

  if (signal.aborted) return null;

  await stream.completed;
  return stream.lastResponseId ?? null;
}
