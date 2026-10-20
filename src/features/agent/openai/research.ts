import { toMarkdownFilename } from "@/shared/github";
import { zodTextFormat } from "openai/helpers/zod";
import {
  researchInput,
  researchInstructions,
  researchResult,
  type ResearchRequest,
} from "../research/research";
import { researchModelAtom } from "../settings/modelSettings";
import { createOpenAIClient } from "./client";

// Research runs as a background response (since it can take a while), which is polled for its results.

const researchResultFormat = zodTextFormat(researchResult.schema, researchResult.name, {
  description: researchResult.description,
});

/** Starts researching a topic, and returns the research task's ID. */
export async function startResearch(request: ResearchRequest) {
  const response = await createOpenAIClient().responses.create({
    model: researchModelAtom.get(),
    instructions: researchInstructions(request.description),
    input: researchInput(request),
    text: { format: researchResultFormat },
    tools: [{ type: "web_search", search_context_size: "high" }],
    background: true,
  });

  return response.id;
}

/** Checks on a research task, and returns its results once it's done (or null while it's running). */
export async function pollResearch(responseId: string) {
  const response = await createOpenAIClient().responses.retrieve(responseId);

  switch (response.status) {
    case "completed": {
      const { title, filename, content } = researchResultFormat.$parseRaw(response.output_text);
      return {
        title,
        filename: toMarkdownFilename(filename),
        content: content.trim(),
      };
    }
    case "failed":
    case "cancelled":
    case "incomplete":
      return { error: response.error?.message ?? "The research task didn't complete." };
    default:
      return null;
  }
}

export async function cancelResearch(responseId: string) {
  try {
    await createOpenAIClient().responses.cancel(responseId);
  } catch (error) {
    console.error("Failed to cancel the research task:", error);
  }
}
