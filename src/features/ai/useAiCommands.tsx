import type { AdditionalReference } from "./agents/openai";
import type { ReviewComment } from "./agents/qa/review";
import { useActiveFile, useFileContent, useSaveFile } from "@/features/files/file";
import { useIsMobile } from "@/shared/useMediaQuery";
import { getGistDescription, isEmptyContent } from "@/shared/github";
import { withFrontMatter } from "@/shared/frontMatter";
import { parseFrontMatter } from "./frontMatter";
import { playAiChime } from "./chime";
import { usePreferences, useUpdatePreferences } from "@/features/account/queries";
import { aiStore, clearReview, updateAiResult, updateAiState } from "./store";
import { readDraft, updateDraft } from "@/features/files/draft";
import { editorViewAtom } from "@/features/editor/store";
import { closeComments, openComments } from "@/features/comments/store";
import { toast } from "sonner";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import {
  getModeSettings,
  parseGlobalFrontMatter,
  resolveReferences,
  type AiMode,
} from "./commands";

/**
 * Runs AI commands (ask, edit, review, research) against the active file,
 * and tracks their progress in the AI store.
 */
export function useAiCommands() {
  const file = useActiveFile();
  const content = useFileContent(file);
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const save = useSaveFile(file);
  const isMobile = useIsMobile();

  const { comments } = useCommentThreads(file);

  const description = file.gist ? getGistDescription(file.gist) : undefined;

  /** The custom instructions for a mode (from the file's frontmatter, and the user's global settings). */
  const getInstructions = (mode: AiMode) =>
    getModeSettings(
      mode,
      parseFrontMatter(content).frontMatter,
      parseGlobalFrontMatter(preferences),
    ).instructions;

  /**
   * The content that a command applies to (the selection, if there is one),
   * and a function for replacing it with the AI's changes.
   */
  function getCommandTarget() {
    const view = editorViewAtom.get();
    const { from, to } = view?.state.selection.main ?? { from: 0, to: 0 };
    const selectedText = view?.state.sliceDoc(from, to) ?? "";
    const hasSelection = !!selectedText.trim();
    const { content: body, frontMatterYaml } = parseFrontMatter(content);
    const range = hasSelection ? { from, to } : { from: 0, to: view?.state.doc.length ?? 0 };

    return {
      hasSelection,
      targetContent: hasSelection ? selectedText : body,
      replace: (updated: string) => {
        // The editor hides frontmatter (unless the user has opted to show it), so
        // when the entire file is replaced, only replace the visible content.
        if (!hasSelection && preferences.showFrontmatter) {
          updated = withFrontMatter(updated, frontMatterYaml);
        }

        if (view) {
          view.dispatch({ changes: { ...range, insert: updated }, userEvent: "ai" });
        } else {
          updateDraft(file, { content: withFrontMatter(updated, frontMatterYaml) });
        }
      },
    };
  }

  async function ask(prompt: string, references: AdditionalReference[], signal: AbortSignal) {
    const previousResponseId = aiStore.state.answer?.responseId;
    updateAiState({
      answer: { text: "", followUp: null, reasoningSummary: null, isWebSearching: false },
    });
    signal.addEventListener("abort", () => updateAiState({ answer: null }));

    const { askContent } = await import("./agents");
    const responseId = await askContent({
      prompt,
      content: getCommandTarget().targetContent,
      description,
      instructions: getInstructions("ask"),
      references,
      previousResponseId,
      signal,
      onUpdate: (changes) => updateAiResult("answer", changes),
    });

    updateAiResult("answer", { responseId: responseId ?? undefined, reasoningSummary: null });
  }

  async function edit(prompt: string, references: AdditionalReference[], signal: AbortSignal) {
    const fileKey = file.key;
    const previous = aiStore.state.edit;

    // Save any manual edits first, so that the diff only includes the AI's edits. (Except for
    // other people's gists, since saving them forks the gist, which opens a different file.)
    const draft = readDraft(file);
    if (!file.isReadOnly && draft && !draft.hasPendingAiEdit) {
      await save();
    }

    const target = getCommandTarget();
    const isEmpty = isEmptyContent(target.targetContent);
    const originalContent = isEmpty ? "" : target.targetContent;
    let editedContent = originalContent;

    const previousResponseId = previous?.fileKey === fileKey ? previous.responseId : undefined;
    updateAiState({ edit: { fileKey, responseId: previousResponseId } });

    // Revert any changes that were made before the edit was cancelled
    signal.addEventListener("abort", () => {
      if (editedContent !== originalContent) target.replace(originalContent);
    });

    const { editContent } = await import("./agents");
    const responseId = await editContent({
      prompt,
      content: originalContent,
      description,
      instructions: getInstructions("edit"),
      references,
      previousResponseId,
      signal,
      onEdit: (edited) => {
        editedContent = edited;
        if (edited === originalContent) return;

        target.replace(edited);

        // Edits to an empty file are simply its new content, so there's nothing to review.
        if (!isEmpty) updateDraft(file, { hasPendingAiEdit: true });
      },
    });

    updateAiResult("edit", { responseId });
    playAiChime();
  }

  async function review(prompt: string, references: AdditionalReference[], signal: AbortSignal) {
    const { hasSelection, targetContent } = getCommandTarget();
    const previous = aiStore.state.review;
    const previousResponseId = previous?.fileKey === file.key ? previous.responseId : undefined;

    openComments({ tab: "ai" });
    updateAiState({
      review: {
        fileKey: file.key,
        title: null,
        comments: [],
        followUp: null,
        reasoningSummary: null,
        isWebSearching: false,
        appliedCommentIds: [],
        applyingCommentId: null,
        responseId: previousResponseId,
      },
    });

    signal.addEventListener("abort", clearReview);

    const { reviewContent } = await import("./agents");
    const responseId = await reviewContent({
      prompt,
      content: targetContent,
      description,
      instructions: getInstructions("review"),
      userComments: !hasSelection && comments.length > 0 ? comments : undefined,
      references,
      previousResponseId,
      signal,
      onUpdate: (changes) => updateAiResult("review", changes),
    });

    updateAiResult("review", { responseId: responseId ?? undefined, reasoningSummary: null });
    playAiChime();
  }

  async function research(topic: string) {
    const { hasSelection, targetContent } = getCommandTarget();
    const { researchTopic } = await import("./agents");
    const id = await researchTopic(
      topic,
      description,
      targetContent,
      !hasSelection && comments.length > 0 ? comments : undefined,
    );

    updatePreferences(({ researchTasks }) => ({
      researchTasks: [
        ...researchTasks,
        { id, gistId: file.gistId, topic, startedTime: new Date().toISOString() },
      ],
    }));
  }

  /**
   * Runs an AI command (one at a time), and returns whether it completed (as opposed to failing,
   * or being cancelled). In "auto" mode, the command's mode is detected from what it asks for.
   */
  async function run(command: string, mode: AiMode | "auto") {
    if (aiStore.state.running) return false;

    // Commands clean up after themselves when they're cancelled (e.g. reverting partial edits).
    const abortController = new AbortController();
    const { signal } = abortController;
    const cancel = () => abortController.abort();
    updateAiState({ running: { mode: mode === "auto" ? null : mode, cancel } });

    try {
      if (mode === "auto") {
        // When the user is iterating on an edit (or an answer), then follow-up
        // commands are likely to be the same kind of command.
        const suspectedMode = readDraft(file)?.hasPendingAiEdit
          ? "edit"
          : aiStore.state.answer || !file.gistId
            ? "ask"
            : undefined;

        const { classifyMode } = await import("./agents");
        mode = await classifyMode(command, !!file.gistId, suspectedMode);
        updateAiState({ running: { mode, cancel } });
      }

      if (mode === "research") {
        await research(command);
        return true;
      }

      const { prompt, references } = await resolveReferences(command, file.gistId);
      if (mode === "ask") await ask(prompt, references, signal);
      else if (mode === "edit") await edit(prompt, references, signal);
      else await review(prompt, references, signal);

      return !signal.aborted;
    } catch (error) {
      if (!signal.aborted) {
        console.error(`Failed to run AI command (${mode}):`, error);
        toast.error("The AI command failed. Please try again.");

        // Clean up after the command (e.g. reverting a partial edit), the same as cancelling it
        abortController.abort();
      }
      return false;
    } finally {
      aiStore.setState((state) =>
        state.running?.cancel === cancel ? { ...state, running: null } : state,
      );
    }
  }

  return {
    run,

    /** Regenerates the review's comments (optionally, with additional context). */
    retryReview: (input?: string) =>
      run(
        `Please generate a new set of comments based on the same request as the previous review${input ? `, and also consider this additional context: "${input}"` : ""}`,
        "review",
      ),

    /** Applies a review comment, by asking the AI to edit the file accordingly. */
    applyReviewComment: async (comment: ReviewComment, input?: string) => {
      updateAiResult("review", { applyingCommentId: comment.id });

      const isApplied = await run(
        `Make the following change to the document: ${comment.applyPrompt}

The following provides some additional context about the change that I'd like to make:
${JSON.stringify({ feedback: comment.comment, referenced_text: comment.referencedText || undefined, replace_with: comment.replaceWith || undefined, insert_after: comment.insertAfter || undefined }, null, 2)}

${input ? `Additionally, here's some extra clarification about how I'd like this change made: "${input}"` : ""}

It's important that you don't simply add the comment text to the document, but rather that you take the time to think about how to best update the document based on your comment (e.g. inserting an item into a list, moving content around, updating a sentence, etc.). Additionally, don't add a commment into the document about the change, simply make the change.`,
        "edit",
      );

      updateAiResult("review", ({ appliedCommentIds }) => ({
        appliedCommentIds: isApplied ? [...appliedCommentIds, comment.id] : appliedCommentIds,
        applyingCommentId: null,
      }));

      if (isApplied && isMobile) closeComments();
    },
  };
}

export type AiCommands = ReturnType<typeof useAiCommands>;
