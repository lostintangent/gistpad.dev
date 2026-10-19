/**
 * The kinds of commands that the agent responds to, which "auto" mode detects (or else lets the
 * agent choose between).
 */
export type AgentMode = "ask" | "edit" | "review" | "research";

/** The composer's modes, where "auto" detects a command's mode, and "talk" sends it to the voice assistant. */
export type ComposerMode = AgentMode | "auto" | "talk";

/** The words that a request starts with, which reliably indicate the kind of response it wants. */
const modeTriggerWords: Record<AgentMode, Set<string>> = {
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
  review: new Set(["discuss", "comment", "suggest", "provide", "critique"]),
  research: new Set(["find", "search", "investigate", "look", "explore"]),
};

/**
 * Detects the kind of response that a request wants (instantly, and locally), so that the UI can
 * reflect it immediately, and the agent can respond without deciding how to. A request's mode
 * is detected when...
 * 1. It starts with a mode's name (e.g. "research"), or a trigger word for it (e.g. "delete" -> "edit").
 * 2. The user's context strongly suggests a mode (e.g. they're iterating on an agent edit).
 *
 * Otherwise, this returns null, and the agent decides how to respond (in the same request).
 */
export function classifyMode(
  request: string,
  { hasFile, suspectedMode }: { hasFile: boolean; suspectedMode?: AgentMode },
): AgentMode | null {
  // Without a file, there's nothing to edit or review
  const availableModes: AgentMode[] = hasFile
    ? ["research", "ask", "edit", "review"]
    : ["research", "ask"];

  const firstWord = request
    .trimStart()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[-,]|(['’](s|re)\b)/g, "");

  const matchedMode = availableModes.find(
    (mode) => mode === firstWord || modeTriggerWords[mode].has(firstWord),
  );
  if (matchedMode) return matchedMode;

  return suspectedMode && availableModes.includes(suspectedMode) ? suspectedMode : null;
}
