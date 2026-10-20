/** The agent's response modes, inferred from a request when the composer is in "auto". */
export const AGENT_MODES = ["ask", "edit", "review", "research"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

/** The composer's modes add automatic classification and voice conversation to response modes. */
export type ComposerMode = AgentMode | "auto" | "talk";

export const availableAgentModes = (hasFile: boolean): readonly AgentMode[] =>
  AGENT_MODES.filter((mode) => hasFile || mode === "ask" || mode === "research");

export function resolveComposerMode(
  selected: ComposerMode,
  hasFile: boolean,
  isTalking: boolean,
): ComposerMode {
  if (isTalking && hasFile) return "talk";
  if (selected === "auto" || availableAgentModes(hasFile).some((mode) => mode === selected)) {
    return selected;
  }
  return "auto";
}

/** What the agent can do in the current context (beyond answering questions). */
export interface Capabilities {
  canEdit: boolean;
  canReview: boolean;
  canResearch: boolean;
  /** The kind of response the user explicitly asked for (as opposed to letting the agent decide). */
  mode?: Exclude<AgentMode, "research">;
}
