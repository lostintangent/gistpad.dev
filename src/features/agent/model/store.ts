import { closeComments } from "@/features/comments/store";
import { persistedAtom } from "@/shared/persistedAtom";
import { createStore, useSelector } from "@tanstack/react-store";
import type { Answer } from "../ask/answer";
import type { Review } from "../review/review";
import type { AgentMode } from "./modes";
import type { AgentProgress } from "./request";

/** The answer to a question, which is displayed above the composer (and is empty while it's thinking). */
export interface AgentAnswer extends Answer, AgentProgress {}

/** An agent review of the active file, which is displayed in the comments panel. */
export interface AgentReview extends Review, AgentProgress {
  fileKey: string;
  appliedCommentIds: number[];
  applyingCommentId: number | null;
}

/**
 * The conversation with the agent about a file, which every command continues (e.g. to ask
 * a follow-up question, refine an edit, or apply a review comment).
 */
interface AgentConversation {
  fileKey: string;
  /** The last response, which is continued by the next command (until there is one, it's a new conversation). */
  responseId?: string;
}

interface AgentState {
  /**
   * The command that's running (one at a time), whose mode is null while the
   * agent is deciding how to respond (and after it's edited the file).
   */
  running: { mode: AgentMode | null; cancel: () => void } | null;
  answer: AgentAnswer | null;
  review: AgentReview | null;
  conversation: AgentConversation | null;
}

export const agentStore = createStore<AgentState>({
  running: null,
  answer: null,
  review: null,
  conversation: null,
});

export function updateAgentState(changes: Partial<AgentState>) {
  agentStore.setState((state) => ({ ...state, ...changes }));
}

type AgentResult<Key extends keyof AgentState> = NonNullable<AgentState[Key]>;

/** Updates the answer or review (if there is one). */
export function updateAgentResult<Key extends "answer" | "review">(
  key: Key,
  changes: Partial<AgentResult<Key>> | ((result: AgentResult<Key>) => Partial<AgentResult<Key>>),
) {
  agentStore.setState((state) => {
    const result = state[key];
    if (!result) return state;

    const resultChanges = typeof changes === "function" ? changes(result) : changes;
    return { ...state, [key]: { ...result, ...resultChanges } };
  });
}

/**
 * Resets the agent state of the previously active file, by cancelling any command that could change
 * it, and clearing its review and conversation. But the answer to a question remains visible
 * (since questions often span files).
 */
export function resetAgentForFile() {
  const { running } = agentStore.state;
  if (running && running.mode !== "ask" && running.mode !== "research") running.cancel();

  updateAgentState({ review: null, conversation: null });
}

/** Clears the review (e.g. once its comments are resolved), which closes the comments panel. */
export function clearReview() {
  updateAgentState({ review: null });
  closeComments();
}

/** Resolves a review comment, which clears the review once all of its comments are resolved. */
export function resolveReviewComment(commentId: number) {
  if (agentStore.state.review?.comments.length === 1) return clearReview();

  updateAgentResult("review", ({ comments }) => ({
    comments: comments.filter(({ id }) => id !== commentId),
  }));
}

export const useIsAgentRunning = () => useSelector(agentStore, ({ running }) => running !== null);

/** The mode of the command that's running (if any). */
export const useRunningMode = () => useSelector(agentStore, ({ running }) => running?.mode ?? null);

export function useAgentReview(fileKey: string) {
  return useSelector(agentStore, ({ review }) => (review?.fileKey === fileKey ? review : null));
}

/** Whether to show pending agent edits as a diff, as opposed to the final content. */
export const showPendingAgentDiffsAtom = persistedAtom("gistpad-show-agent-diffs", true);
