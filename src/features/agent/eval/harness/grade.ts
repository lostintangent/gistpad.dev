import type { Answer } from "../../ask/answer";
import type { Review } from "../../review/review";
import { spliceSelection, type Scenario } from "./parse";

export function normalizeDocument(text: string) {
  return text.replaceAll("\r\n", "\n").replace(/\n+$/, "") + "\n";
}

export interface GradeInput {
  answer: Answer | null;
  document: string;
  review: Review | null;
  reviewEnded: boolean;
  patchApplied: boolean;
  patchFailures: string[];
}

export function gradeScenario(scenario: Scenario, input: GradeInput) {
  const failures = [...input.patchFailures.map((output) => `patch failed: ${output}`)];
  const supplied = scenario.selection ?? scenario.fixtureText;
  const finalDocument = scenario.selection
    ? spliceSelection(scenario.fixtureText, scenario.selection, input.document, scenario.path)
    : input.document;

  if (scenario.mode === "ask") {
    const text = input.answer?.text ?? "";
    if (!text.trim()) failures.push("empty answer");
  }

  if (scenario.mode === "edit") {
    if (scenario.expectUnchanged) {
      if (normalizeDocument(finalDocument) !== normalizeDocument(scenario.fixtureText)) {
        failures.push("document changed");
      }
    } else {
      if (!input.patchApplied) failures.push("no patch applied");
      if (normalizeDocument(finalDocument) === normalizeDocument(scenario.fixtureText)) {
        failures.push("document unchanged");
      }
    }
    if (scenario.expectedText !== undefined) {
      if (normalizeDocument(finalDocument) !== normalizeDocument(scenario.expectedText)) {
        failures.push("final document does not match expected Markdown");
      }
    }
  }

  if (scenario.mode === "review") {
    if (!input.reviewEnded) failures.push("review tool did not complete");
    const comments = input.review?.comments ?? [];
    for (const comment of comments) {
      const referenced = comment.referencedText;
      if (referenced) {
        if (!supplied.includes(referenced)) {
          failures.push(`referencedText not in supplied document: ${JSON.stringify(referenced)}`);
        }
      } else if (comment.replaceWith || comment.insertAfter) {
        failures.push("replacement/insertion needs referencedText as its anchor");
      }
      if (comment.replaceWith && comment.insertAfter) {
        failures.push("cannot set both replaceWith and insertAfter");
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    quality: "unreviewed" as const,
    finalDocument,
  };
}
