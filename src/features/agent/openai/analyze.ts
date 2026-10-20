import type { Gist } from "@/shared/github";
import { researchModelAtom } from "../settings/modelSettings";
import { styleAnalysisInput, styleAnalysisInstructions } from "../settings/styleAnalysis";
import { createOpenAIClient } from "./client";

/** Analyzes the writing style of the user's gists, and returns instructions for matching it. */
export async function analyzeStyle(gists: Gist[]) {
  const response = await createOpenAIClient().responses.create({
    model: researchModelAtom.get(),
    instructions: styleAnalysisInstructions,
    input: styleAnalysisInput(gists),
  });

  return response.output_text;
}
