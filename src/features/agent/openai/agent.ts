import {
  Agent,
  isOpenAIResponsesRawModelStreamEvent,
  OpenAIResponsesModel,
  run,
  webSearchTool,
  type Tool,
} from "@openai/agents";
import { JSONParser, type ParsedElementInfo } from "@streamparser/json";
import { answerSchema, createAnswerParser } from "../ask/answer";
import { gistTools } from "../model/gistTools";
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

/**
 * Responds to a request, by answering it, editing or reviewing the current document, or starting
 * a research task (depending on the mode, and what the agent decides). Returns the response's
 * ID, which allows continuing the conversation.
 */
export async function runAgent(request: AgentRequest) {
  const { document, signal } = request;
  const { capabilities, instructions, input } = getAgentPrompt(request);

  const tools: Tool[] = [webSearchTool(), ...gistTools.map((gistTool) => toSdkTool(gistTool))];
  if (document && capabilities.canEdit) tools.push(editTool(document, request.onEdit));
  if (capabilities.canReview) tools.push(toSdkTool(reviewTool(request.onReviewEnd)));
  if (request.onResearch && capabilities.canResearch) {
    tools.push(toSdkTool(researchTool(request.onResearch)));
  }

  const agent = new Agent({
    name: "GistPad",
    instructions,
    model: new OpenAIResponsesModel(createOpenAIClient(), agentModelAtom.get()),
    modelSettings: {
      // Its reasoning is summarized as it streams in, which is displayed as its progress
      reasoning: { summary: "auto" },
      text: { verbosity: "low" },
    },
    outputType: answerSchema,
    tools,
  });

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
