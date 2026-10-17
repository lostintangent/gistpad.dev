import { closeComments } from "@/features/comments/store";
import { persistedAtom } from "@/shared/persistedAtom";
import { createStore, useSelector } from "@tanstack/react-store";
import type { AgentFollowUp } from "./agents/openai";
import type { ReviewComment } from "./agents/qa/review";
import type { AiMode } from "./useAiCommands";

/** The answer to an "ask" command, which is displayed above the action bar. */
export interface AiAnswer {
  /** The (markdown) answer, which is empty while the AI is thinking. */
  text: string;
  followUp: AgentFollowUp | null;
  reasoningSummary: string | null;
  isWebSearching: boolean;
  /** Allows follow-up questions to continue the conversation. */
  responseId?: string;
}

/** An AI edit of the open document. */
export interface AiEdit {
  documentKey: string;
  stats: { additions: number; deletions: number } | null;
  /** Allows follow-up edits to refine the previous ones. */
  responseId?: string;
}

/** An AI review of the open document, which is displayed in the comments panel. */
export interface AiReview {
  documentKey: string;
  request: string;
  title: string | null;
  comments: ReviewComment[];
  followUp: AgentFollowUp | null;
  reasoningSummary: string | null;
  isWebSearching: boolean;
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

type AiResults = Pick<AiState, "answer" | "edit" | "review">;

/** Updates the answer, edit or review (if there is one). */
export function updateAiResult<Key extends keyof AiResults>(
  key: Key,
  changes:
    | Partial<NonNullable<AiResults[Key]>>
    | ((result: NonNullable<AiResults[Key]>) => Partial<NonNullable<AiResults[Key]>>),
) {
  aiStore.setState((state) => {
    const result = state[key];
    if (!result) return state;

    const resultChanges = typeof changes === "function" ? changes(result) : changes;
    return { ...state, [key]: { ...result, ...resultChanges } };
  });
}

/** Clears the review (e.g. once its comments are resolved), which closes the comments panel. */
export function clearReview() {
  updateAiState({ review: null });
  closeComments();
}

export const useIsAiInProgress = () => useSelector(aiStore, ({ running }) => running !== null);

/** The mode of the command that's running (if any). */
export const useRunningMode = () => useSelector(aiStore, ({ running }) => running?.mode ?? null);

export function useAiEdit(documentKey: string) {
  return useSelector(aiStore, ({ edit }) => (edit?.documentKey === documentKey ? edit : null));
}

export function useAiReview(documentKey: string) {
  return useSelector(aiStore, ({ review }) =>
    review?.documentKey === documentKey ? review : null,
  );
}

/** Whether to show pending AI edits as a diff, as opposed to the final content. */
export const showPendingAiDiffsAtom = persistedAtom("gistpad-show-ai-diffs", true);
