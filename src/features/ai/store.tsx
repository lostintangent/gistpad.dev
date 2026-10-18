import { closeComments } from "@/features/comments/store";
import { persistedAtom } from "@/shared/persistedAtom";
import { createStore, useSelector } from "@tanstack/react-store";
import type { AskResult } from "./agents/qa/ask";
import type { ReviewResult } from "./agents/qa/review";
import type { AiMode } from "./commands";

/** The answer to an "ask" command, which is displayed above the action bar. */
export interface AiAnswer extends AskResult {
  /** Allows follow-up questions to continue the conversation. */
  responseId?: string;
}

/** The AI's edits to the active file (which are pending in its draft, until they're accepted). */
interface AiEdit {
  fileKey: string;
  /** Allows follow-up edits to refine the previous ones. */
  responseId?: string;
}

/** An AI review of the active file, which is displayed in the comments panel. */
export interface AiReview extends ReviewResult {
  fileKey: string;
  appliedCommentIds: number[];
  applyingCommentId: number | null;
  responseId?: string;
}

interface AiState {
  /** The command that's running (one at a time), whose mode is null while it's being classified. */
  running: { mode: AiMode | null; cancel: () => void } | null;
  answer: AiAnswer | null;
  edit: AiEdit | null;
  review: AiReview | null;
}

export const aiStore = createStore<AiState>({
  running: null,
  answer: null,
  edit: null,
  review: null,
});

export function updateAiState(changes: Partial<AiState>) {
  aiStore.setState((state) => ({ ...state, ...changes }));
}

type AiResult<Key extends keyof AiState> = NonNullable<AiState[Key]>;

/** Updates the answer, edit or review (if there is one). */
export function updateAiResult<Key extends "answer" | "edit" | "review">(
  key: Key,
  changes: Partial<AiResult<Key>> | ((result: AiResult<Key>) => Partial<AiResult<Key>>),
) {
  aiStore.setState((state) => {
    const result = state[key];
    if (!result) return state;

    const resultChanges = typeof changes === "function" ? changes(result) : changes;
    return { ...state, [key]: { ...result, ...resultChanges } };
  });
}

/**
 * Resets the AI state of the previously active file, by cancelling (and clearing) its edit
 * or review. But the answer to a question remains visible (since questions often span
 * files), as a new conversation.
 */
export function resetAiForFile() {
  const { running } = aiStore.state;
  if (running?.mode === "edit" || running?.mode === "review") running.cancel();

  aiStore.setState((state) => ({
    ...state,
    edit: null,
    review: null,
    answer: state.answer && { ...state.answer, responseId: undefined },
  }));
}

/** Clears the review (e.g. once its comments are resolved), which closes the comments panel. */
export function clearReview() {
  updateAiState({ review: null });
  closeComments();
}

export const useIsAiInProgress = () => useSelector(aiStore, ({ running }) => running !== null);

/** The mode of the command that's running (if any). */
export const useRunningMode = () => useSelector(aiStore, ({ running }) => running?.mode ?? null);

export function useAiReview(fileKey: string) {
  return useSelector(aiStore, ({ review }) => (review?.fileKey === fileKey ? review : null));
}

/** Whether to show pending AI edits as a diff, as opposed to the final content. */
export const showPendingAiDiffsAtom = persistedAtom("gistpad-show-ai-diffs", true);
