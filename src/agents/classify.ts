import { createOpenAIClient } from "./openai";

const actionTriggerWords = {
  ask: new Set([
    "what",
    "whats",
    "who",
    "where",
    "whose",
    "when",
    "why",
    "which",
    "how",
    "explain",
    "describe",
    "tell",
    "do",
    "does",
    "is",
    "are",
    "was",
    "were",
    "can",
  ]),
  edit: new Set([
    // Core editing
    "write",
    "change",
    "update",
    "revise",
    "modify",
    "fix",
    "tweak",
    "reword",
    "rephrase",
    "replace",
    "make",

    // Addition/removal
    "add",
    "insert",
    "delete",
    "remove",
    "cut",
    "trim",

    // Structural changes
    "move",
    "reorganize",
    "restructure",
    "shorten",
    "expand",
    "condense",
    "duplicate",

    // Quality improvements
    "improve",
    "refactor",
    "rewrite",
    "enhance",
    "polish",
    "clarify",
    "simplify",
    "correct",
    "clean",
  ]),
  discuss: new Set(["review", "comment", "suggest", "provide", "critique"]),
  research: new Set(["find", "search", "investigate", "look", "explore"]),
};

// In order to balance speed and accuracy, we leverage a two-step classification process,
// which first attempts to statically classify the request based on high confidence heuristics,
// and then falls back to performing semantic classification using an LLM if necessary.
//
// 1. Static classification
//    1. If the request starts with an action name (e.g. "research"), then we assume that's the mode they want.
//    2. If the request starts with a known "trigger word" for an action (e.g. "delete" -> "edit"), then we assume that's the mode they want.
//    3. If the user's context strongly suggests a specific action (e.g. they're currently editing with AI).
// 2. Semantic classification (using an LLM)

export async function classifyAction(
  request: string,
  hasGistSelected: boolean = true,
  suspectedAction?: string
): Promise<string> {
  // Determine which actions are available based
  // on whether the user currently has a gist opened.
  const availableActions = ["research", "ask"];
  if (hasGistSelected) {
    availableActions.push("edit", "discuss");
  }

  const firstWord = request
    .split(" ")[0]
    .toLowerCase()
    .replace(/[-,]|(['’](s|re)\b)/g, "");

  // If the request specifically starts with
  // one of the action names, then return it directly
  if (availableActions.includes(firstWord)) {
    return firstWord;
  }

  // Check whether the request starts with any of the trigger
  // words for the available actions. And if so, return that action.
  for (const action of availableActions) {
    if (actionTriggerWords[action].has(firstWord)) {
      return action;
    }
  }

  if (suspectedAction && availableActions.includes(suspectedAction)) {
    // If a suspected action is provided and it's available,
    // return it directly.
    return suspectedAction;
  }

  // None of the statuc heuristics matches, so perform semantic classification
  const openai = createOpenAIClient();
  const { output_text } = await openai.responses.create({
    prompt: {
      id: "pmpt_687ff9ab138c8194b622d673059b7f4e03ac6cc27dce819b",
    },
    input: request,
    model: "gpt-4.1-nano",
  });

  const actionIndex = parseInt(output_text.trim()) - 1;
  return availableActions[actionIndex] || "ask";
}
