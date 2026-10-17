import type { AdditionalReference } from "./agents/openai";
import type { ReviewComment } from "./agents/qa/review";
import { useDocument, useDocumentContent, useSaveOrFork } from "@/features/editor/document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { getDefaultFile, getGistDescription, isEmptyContent } from "@/shared/github";
import { parseFrontMatter } from "@/shared/frontMatter";
import { playAiChime, withFrontMatter } from "@/shared/utils";
import { readGistFile, useGists } from "@/features/gists/queries";
import {
  parseGlobalFrontMatter,
  usePreferences,
  useUpdatePreferences,
} from "@/features/session/queries";
import { aiStore, clearReview, updateAiResult, updateAiState } from "./store";
import { draftAtom, editorViewAtom, updateDraft } from "@/features/editor/store";
import { closeComments, openComments } from "@/features/comments/store";
import { toast } from "sonner";
import { Chunk, getChunks, rejectChunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { useCommentThreads } from "@/features/comments/useCommentThreads";

export type AiMode = "ask" | "edit" | "discuss" | "research";

/** The modes that commands can be run in, where "auto" detects the mode from the command. */
export type CommandMode = AiMode | "auto";

/** Counts the lines that were added and deleted between two versions of a document. */
function getDiffStats(original: string, updated: string) {
  const a = Text.of(original.split(/\r?\n/));
  const b = Text.of(updated.split(/\r?\n/));
  const countLines = (text: Text, from: number, to: number) =>
    from === to ? 0 : text.lineAt(to - 1).number - text.lineAt(from).number + 1;

  let additions = 0;
  let deletions = 0;
  for (const chunk of Chunk.build(a, b)) {
    additions += countLines(b, chunk.fromB, chunk.toB);
    deletions += countLines(a, chunk.fromA, chunk.toA);
  }

  return { additions, deletions };
}

/**
 * Runs AI commands (ask, edit, review, research) against the open document,
 * and tracks their progress in the AI store.
 */
export function useAiCommands() {
  const doc = useDocument();
  const content = useDocumentContent(doc);
  const { gists } = useGists();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const saveOrFork = useSaveOrFork(doc);
  const isMobile = useIsMobile();

  const { comments } = useCommentThreads(doc);

  const description = doc.gist ? getGistDescription(doc.gist) : undefined;

  /** Resolves `@[Gist]` and `#[File]` references in a command into additional context. */
  async function resolveReferences(command: string) {
    const references: AdditionalReference[] = [];

    for (const [, title] of command.matchAll(/@\[([^\]]+)\]/g)) {
      const gist = gists.find((gist) => gist.description === title);
      if (gist) {
        references.push({ title, content: await readGistFile(gist.id, getDefaultFile(gist)) });
      }
    }

    for (const [, title] of command.matchAll(/#\[([^\]]+)\]/g)) {
      if (doc.gistId) {
        references.push({ title, content: await readGistFile(doc.gistId, `${title}.md`) });
      }
    }

    return { prompt: command.replace(/[@#]\[([^\]]+)\]/g, '"$1"'), references };
  }

  /** Combines the custom AI instructions from the document's frontmatter and the user's global settings. */
  function getInstructions(mode: "edit" | "discuss" | "ask") {
    const local = parseFrontMatter(content).frontMatter ?? {};
    const global = parseGlobalFrontMatter(preferences);
    const section = mode === "edit" ? "edit" : "discuss";

    const instructions = [
      global.general?.instructions,
      local.general?.instructions,
      local[section]?.overridesGlobalSettings !== true && global[section]?.instructions,
      local[section]?.instructions,
    ].filter(Boolean);

    return instructions.length > 0 ? instructions.join("\n\n---\n\n") : undefined;
  }

  /**
   * The content that a command applies to (the selection, if there is one),
   * and a function for replacing it with the AI's changes.
   */
  function getCommandTarget() {
    const view = editorViewAtom.get();
    const selection = view?.state.selection.main;
    const selectedText = selection && view.state.sliceDoc(selection.from, selection.to);
    const hasSelection = !!selectedText?.trim();
    const { content: body, frontMatterYaml } = parseFrontMatter(content);

    const range = hasSelection
      ? { from: selection!.from, to: selection!.to }
      : { from: 0, to: view?.state.doc.length ?? 0 };

    return {
      hasSelection,
      targetContent: hasSelection ? selectedText! : body,
      replace: (updated: string) => {
        // The editor hides frontmatter (unless the user has opted to show it), so
        // when the entire document is replaced, only replace the visible content.
        if (!hasSelection && preferences.showFrontmatter) {
          updated = withFrontMatter(updated, frontMatterYaml);
        }

        if (view) {
          view.dispatch({ changes: { ...range, insert: updated }, userEvent: "ai" });
        } else {
          updateDraft(doc.documentKey, doc.savedContent, {
            content: withFrontMatter(updated, frontMatterYaml),
          });
        }
      },
    };
  }

  /** Loads the AI agents (on demand), along with tools that let them read the user's gists. */
  async function loadAgents() {
    const agents = await import("./agents");
    const tools = agents.createGistTools({
      listGists: () => gists.map(({ description, id }) => ({ name: description, id })),
      readGist: (gistId) => readGistFile(gistId),
    });
    return { ...agents, tools };
  }

  async function ask(prompt: string, references: AdditionalReference[], signal: AbortSignal) {
    const previousResponseId = aiStore.state.answer?.responseId;
    updateAiState({
      answer: { text: "", followUp: null, reasoningSummary: null, isWebSearching: false },
    });
    signal.addEventListener("abort", () => updateAiState({ answer: null }));

    const { askContent, tools } = await loadAgents();
    const responseId = await askContent({
      prompt,
      content: getCommandTarget().targetContent,
      description,
      instructions: getInstructions("ask"),
      references,
      previousResponseId,
      signal,
      tools,
      onAnswer: (text) => updateAiResult("answer", { text }),
      onFollowUp: (followUp) => updateAiResult("answer", { followUp }),
      onReasoning: (reasoningSummary) => updateAiResult("answer", { reasoningSummary }),
      onWebSearching: (isWebSearching) => updateAiResult("answer", { isWebSearching }),
    });

    updateAiResult("answer", { responseId: responseId ?? undefined, reasoningSummary: null });
  }

  async function edit(prompt: string, references: AdditionalReference[], signal: AbortSignal) {
    const { documentKey, savedContent } = doc;
    const previous = aiStore.state.edit;

    // Save any manual edits first, so that the diff only includes the AI's edits. (Except for
    // other people's gists, since saving them forks the gist, which opens a different document.)
    const draft = draftAtom.get();
    if (!doc.isReadOnly && draft?.documentKey === documentKey && !draft.hasPendingAiEdit) {
      await saveOrFork();
    }

    const target = getCommandTarget();
    const isEmpty = isEmptyContent(target.targetContent);
    const originalContent = isEmpty ? "" : target.targetContent;
    let editedContent = originalContent;

    const previousResponseId =
      previous?.documentKey === documentKey ? previous.responseId : undefined;
    updateAiState({ edit: { documentKey, stats: null, responseId: previousResponseId } });

    // Revert any changes that were made before the edit was cancelled
    signal.addEventListener("abort", () => {
      if (editedContent !== originalContent) target.replace(originalContent);
    });

    const { editContent } = await loadAgents();
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

        // Edits to an empty document are simply its new content, so there's nothing to review.
        if (!isEmpty) {
          const current = draftAtom.get()?.content ?? savedContent;
          updateDraft(documentKey, savedContent, { hasPendingAiEdit: true });
          updateAiResult("edit", { stats: getDiffStats(savedContent, current) });
        }
      },
    });

    updateAiResult("edit", { responseId });
    playAiChime();
  }

  async function review(
    prompt: string,
    references: AdditionalReference[],
    signal: AbortSignal,
    { isRetry = false } = {},
  ) {
    const { hasSelection, targetContent } = getCommandTarget();
    const previous = aiStore.state.review;
    const isSameDocument = previous?.documentKey === doc.documentKey;

    const previousResponseId = isSameDocument ? previous.responseId : undefined;
    openComments({ tab: "ai" });
    updateAiState({
      review: {
        documentKey: doc.documentKey,
        request: isRetry && previous ? previous.request : prompt,
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

    const { reviewContent, tools } = await loadAgents();
    const responseId = await reviewContent({
      prompt,
      content: targetContent,
      description,
      instructions: getInstructions("discuss"),
      userComments: !hasSelection && comments.length > 0 ? comments : undefined,
      references,
      previousResponseId,
      signal,
      tools,
      onComments: (comments) => updateAiResult("review", { comments }),
      onTitle: (title) => updateAiResult("review", { title }),
      onFollowUp: (followUp) => updateAiResult("review", { followUp }),
      onReasoning: (reasoningSummary) => updateAiResult("review", { reasoningSummary }),
      onWebSearching: (isWebSearching) => updateAiResult("review", { isWebSearching }),
    });

    updateAiResult("review", { responseId: responseId ?? undefined, reasoningSummary: null });
    playAiChime();
  }

  async function research(topic: string) {
    const { hasSelection, targetContent } = getCommandTarget();
    const { researchTopic } = await loadAgents();
    const id = await researchTopic(
      topic,
      description,
      targetContent,
      !hasSelection && comments.length > 0 ? comments : undefined,
    );

    updatePreferences(({ researchTasks }) => ({
      researchTasks: [
        ...researchTasks,
        { id, gistId: doc.gistId, topic, startedTime: new Date().toISOString() },
      ],
    }));
  }

  /**
   * Runs an AI command (one at a time), and returns whether it completed (as opposed to failing,
   * or being cancelled). In "auto" mode, the command's mode is detected from what it asks for.
   */
  async function run(
    command: string,
    mode: CommandMode,
    { isRetry = false, suspectedMode }: { isRetry?: boolean; suspectedMode?: AiMode } = {},
  ) {
    if (aiStore.state.running) return false;

    // Commands clean up after themselves when they're cancelled (e.g. reverting partial edits).
    const abortController = new AbortController();
    const { signal } = abortController;
    const cancel = () => abortController.abort();
    updateAiState({ running: { mode: mode === "auto" ? null : mode, cancel } });

    try {
      if (mode === "auto") {
        const { classifyAction } = await import("./agents");
        mode = await classifyAction(command, !!doc.gistId, suspectedMode);
        updateAiState({ running: { mode, cancel } });
      }

      if (mode === "research") {
        await research(command);
        return true;
      }

      const { prompt, references } = await resolveReferences(command);
      if (mode === "ask") await ask(prompt, references, signal);
      else if (mode === "edit") await edit(prompt, references, signal);
      else await review(prompt, references, signal, { isRetry });

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
        "discuss",
        { isRetry: true },
      ),

    /** Applies a review comment, by asking the AI to edit the document accordingly. */
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

    /** Accepts all of the pending AI edits (by saving them). */
    acceptEdit: async () => {
      await saveOrFork();
      updateAiState({ edit: null });
    },

    /** Rejects all of the pending AI edits. */
    rejectEdit: () => {
      const view = editorViewAtom.get();
      if (!view) return;

      for (const chunk of [...(getChunks(view.state)?.chunks ?? [])].reverse()) {
        rejectChunk(view, chunk.fromB);
      }

      updateAiState({ edit: null });
    },
  };
}

export type AiCommands = ReturnType<typeof useAiCommands>;
