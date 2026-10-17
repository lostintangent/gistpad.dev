import { persistedAtom } from "@/shared/persistedAtom";
import { createAtom, createStore } from "@tanstack/react-store";

/** Whether the comments panel is open, which is preserved while navigating between gists. */
export const commentsPanelOpenAtom = createAtom(false);

/** The width of the comments panel (as a percentage). */
export const commentsPanelSizeAtom = persistedAtom("gistpad-comments-width", 20);

interface CommentsState {
  selectedCommentId: number | null;
  replyingToCommentId: number | null;
  /** The new comment that's being written (which can be prefilled with a quote of the selected text). */
  newCommentText: string;
  /** Requests that the new comment input be focused (e.g. after quoting text, or starting a reply). */
  shouldFocusInput: boolean;
  tab: "user" | "ai";
}

const initialState: CommentsState = {
  selectedCommentId: null,
  replyingToCommentId: null,
  newCommentText: "",
  shouldFocusInput: false,
  tab: "user",
};

/** The state of the comments panel, for the open document. */
export const commentsStore = createStore(initialState);

export function updateComments(changes: Partial<CommentsState>) {
  commentsStore.setState((state) => ({ ...state, ...changes }));
}

export function resetComments() {
  commentsStore.setState(() => initialState);
}

/** Opens the comments panel (e.g. to a specific comment, or with a quote of the selected text). */
export function openComments({
  commentId,
  reply = false,
  quote,
  tab = "user",
}: { commentId?: number; reply?: boolean; quote?: string; tab?: "user" | "ai" } = {}) {
  commentsPanelOpenAtom.set(true);
  updateComments({
    tab,
    ...(commentId !== undefined && { selectedCommentId: commentId }),
    ...(reply && { replyingToCommentId: commentId }),
    ...(quote && { newCommentText: `> ${quote}\n\n` }),
    ...((reply || quote) && { shouldFocusInput: true }),
  });
}

export function closeComments() {
  commentsPanelOpenAtom.set(false);
  resetComments();
}
