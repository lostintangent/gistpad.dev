import { openComments } from "@/features/comments/store";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { editorViewAtom } from "@/features/editor/store";
import { readDraft, updateDraft } from "@/features/files/draft";
import { useActiveFile, useFileContent, useSaveFile } from "@/features/files/file";
import { splitFrontMatter, withFrontMatter } from "@/shared/frontMatter";
import { getGistDescription, isEmptyContent } from "@/shared/github";
import { toast } from "sonner";
import type { Answer } from "../ask/answer";
import { classifyMode } from "../auto/classify";
import { useResearchTasks } from "../research/useResearchTasks";
import type { Review } from "../review/review";
import { useAgentSettings } from "../settings/useAgentSettings";
import { playChime } from "../shared/chime";
import { resolveReferences, toAgentDocument } from "./context";
import { prepareAgentInput } from "./input";
import type { AgentMode } from "./modes";
import type { AgentProgress, AgentRequest } from "./request";
import { agentStore, clearReview, updateAgentResult, updateAgentState } from "./store";

const IDLE_PROGRESS: AgentProgress = { reasoningSummary: null, isWebSearching: false };

/** The kind of response that an agent command completed with (and its answer or review). */
export type AgentRunResult =
  | { mode: "ask"; answer: Answer | null }
  | { mode: "review"; review: Review }
  | { mode: "edit" }
  | { mode: "research" };

/**
 * Runs agent commands (ask, edit, review, research, or auto) against the active file,
 * and tracks their progress in the agent's store.
 */
export function useAgent() {
  const file = useActiveFile();
  const content = useFileContent(file);
  const settings = useAgentSettings(file);
  const save = useSaveFile(file);
  const researchTasks = useResearchTasks();

  const { comments } = useCommentThreads(file);

  const description = file.gist ? getGistDescription(file.gist) : undefined;

  /**
   * The content that a command applies to (the selection, if there is one), and a function for
   * replacing it with the agent's changes. The file's comments are also context for the command
   * (unless it applies to a selection).
   */
  function getCommandTarget() {
    const view = editorViewAtom.get();
    const { from, to } = view?.state.selection.main ?? { from: 0, to: 0 };
    const selectedText = view?.state.sliceDoc(from, to) ?? "";
    const hasSelection = !!selectedText.trim();
    const { content: body, frontMatterYaml } = splitFrontMatter(content);
    let range = hasSelection ? { from, to } : { from: 0, to: view?.state.doc.length ?? 0 };

    return {
      hasSelection,
      targetContent: hasSelection ? selectedText : body,
      userComments: !hasSelection && comments.length > 0 ? comments : undefined,
      replace: (updated: string) => {
        // (The agent is given the content without its frontmatter, which is kept when it's all replaced)
        if (!hasSelection) updated = withFrontMatter(updated, frontMatterYaml);

        if (view) {
          view.dispatch({ changes: { ...range, insert: updated }, userEvent: "agent" });

          // The agent can replace the content more than once, so track its new range
          range = { from: range.from, to: range.from + updated.length };
        } else {
          updateDraft(file, { content: updated });
        }
      },
    };
  }

  function research(topic: string) {
    const { targetContent, userComments } = getCommandTarget();
    return researchTasks.start(
      { topic, description, context: targetContent, userComments },
      file.gistId,
    );
  }

  /**
   * Responds to a command with the agent, which answers it, edits or reviews the file, or
   * starts a research task (as the mode requires, or else as it decides). Returns the kind of
   * response it gave (and its answer or review).
   */
  async function respond(
    input: string,
    mode: AgentRequest["mode"],
    signal: AbortSignal,
    setRunningMode: (mode: AgentMode | null) => void,
  ): Promise<AgentRunResult> {
    // Every command continues the file's conversation, which is reset when a different file is
    // opened (which detaches the command from its file, so that it can't edit or review it).
    const fileKey = file.key;
    const { conversation } = agentStore.state;
    const previousResponseId =
      conversation?.fileKey === fileKey ? conversation.responseId : undefined;
    updateAgentState({ conversation: { fileKey, responseId: previousResponseId } });
    const isAttached = () => agentStore.state.conversation?.fileKey === fileKey;

    const target = getCommandTarget();
    const isEmpty = isEmptyContent(target.targetContent);
    let response = "ask" as AgentMode;
    let answer: Answer | null = null;
    let review: Review = { title: null, comments: [], followUp: null };

    // Where the agent's progress (e.g. its reasoning) is displayed, which is an empty answer
    // while it's thinking (unless it was asked to edit or review the file).
    let surface = null as "answer" | "review" | null;
    const removeEmptyAnswer = () =>
      agentStore.setState((state) =>
        state.answer?.text === "" ? { ...state, answer: null } : state,
      );

    const startReview = () => {
      surface = "review";
      openComments({ tab: "agent" });
      updateAgentState({
        review: {
          fileKey,
          title: null,
          comments: [],
          followUp: null,
          ...IDLE_PROGRESS,
          appliedCommentIds: [],
          applyingCommentId: null,
        },
      });
    };

    if (mode === "review") {
      startReview();
    } else if (mode !== "edit") {
      surface = "answer";
      updateAgentState({ answer: { text: "", followUp: null, ...IDLE_PROGRESS } });
    }

    // Edits remain pending (to be accepted or rejected), but partial answers and reviews are removed
    signal.addEventListener("abort", () => {
      if (surface === "answer") updateAgentState({ answer: null });
      else if (surface === "review") clearReview();
    });

    // Save any manual edits before the first agent edit, so that the diff only includes the agent's edits.
    // (Except for other people's gists, since saving them forks the gist, which opens a different file.)
    let saveManualEdits: Promise<void> | undefined;

    const { prompt, references } = await resolveReferences(input, file.gistId);
    const { runAgent } = await import("../openai");
    const responseId = await runAgent({
      mode,
      prompt,
      document: toAgentDocument(file, target.targetContent, target.hasSelection),
      instructions: {
        general: settings.general.instructions,
        edit: settings.edit.instructions,
        review: settings.review.instructions,
      },
      references,
      userComments: target.userComments,
      previousResponseId,
      signal,
      onProgress: (changes) => surface && updateAgentResult(surface, changes),
      onAnswer: (latest) => {
        surface = "answer";
        answer = latest;
        setRunningMode("ask");
        agentStore.setState((state) => ({
          ...state,
          answer: { ...IDLE_PROGRESS, ...state.answer, ...latest },
        }));
      },
      onEditStart: () => {
        if (!isAttached()) return;

        surface = null;
        setRunningMode("edit");
        removeEmptyAnswer();
      },
      onEdit: async (edited) => {
        if (!isAttached()) throw new Error("The document was closed, so it can't be edited.");

        saveManualEdits ??= (async () => {
          const draft = readDraft(file);
          if (!file.isReadOnly && draft && !draft.hasPendingAgentEdit) await save();
        })();
        await saveManualEdits;

        target.replace(edited);
        response = "edit";

        // Edits to an empty file are simply its new content, so there's nothing to review.
        if (!isEmpty) updateDraft(file, { hasPendingAgentEdit: true });

        // The edits can be accepted (or rejected) while the agent finishes responding
        setRunningMode(null);
      },
      onReviewStart: () => {
        if (!isAttached()) return;

        response = "review";
        setRunningMode("review");
        removeEmptyAnswer();
        if (mode !== "review") startReview();
      },
      onReview: (changes) => {
        if (response !== "review" || !isAttached()) return;

        review = { ...review, ...changes };
        updateAgentResult("review", changes);
      },
      onReviewEnd: () => {
        // The review is complete (while the agent finishes responding), so it's no longer in progress
        surface = null;
        setRunningMode(null);
      },
      onResearch:
        mode === "auto"
          ? async (topic) => {
              surface = null;
              response = "research";
              setRunningMode("research");
              removeEmptyAnswer();
              await research(topic);
            }
          : undefined,
    });

    const result = (): AgentRunResult =>
      response === "ask"
        ? { mode: "ask", answer }
        : response === "review"
          ? { mode: "review", review }
          : { mode: response };

    if (signal.aborted) return result();
    if (responseId && isAttached()) updateAgentState({ conversation: { fileKey, responseId } });

    removeEmptyAnswer();
    updateAgentResult("answer", IDLE_PROGRESS);
    if (response === "review") updateAgentResult("review", IDLE_PROGRESS);
    else if (surface === "review") clearReview(); // It was asked to review, but answered instead

    if (response === "edit" || response === "review") playChime();
    return result();
  }

  /**
   * Runs an agent command (one at a time), and returns the kind of response that it completed with
   * (or null if it failed, or was cancelled). In "auto" mode, the command's mode is detected from
   * what it asks for, and when that's ambiguous, the agent decides how to respond.
   */
  async function run(input: string, mode: AgentMode | "auto"): Promise<AgentRunResult | null> {
    if (agentStore.state.running) return null;
    const prepared = prepareAgentInput(input, mode, settings, !!file.gistId);
    const prompt = prepared.prompt;
    mode = prepared.mode;

    const abortController = new AbortController();
    const { signal } = abortController;
    const cancel = () => abortController.abort();
    const setRunningMode = (mode: AgentMode | null) =>
      agentStore.setState((state) =>
        state.running?.cancel === cancel ? { ...state, running: { mode, cancel } } : state,
      );

    if (mode === "auto") {
      // When the user is iterating on an edit (or an answer), then follow-up
      // commands are likely to be the same kind of command.
      const suspectedMode = readDraft(file)?.hasPendingAgentEdit
        ? "edit"
        : agentStore.state.answer || !file.gistId
          ? "ask"
          : undefined;

      mode = classifyMode(prompt, { hasFile: !!file.gistId, suspectedMode }) ?? "auto";
    }

    updateAgentState({ running: { mode: mode === "auto" ? null : mode, cancel } });

    try {
      if (mode === "research") {
        await research(prompt);
        return { mode: "research" };
      }

      const result = await respond(prompt, mode, signal, setRunningMode);
      return signal.aborted ? null : result;
    } catch (error) {
      if (!signal.aborted) {
        console.error(`Failed to run agent command (${mode}):`, error);
        toast.error("The agent command failed. Please try again.");

        // Clean up after the command (e.g. removing a partial answer), the same as cancelling it
        abortController.abort();
      }
      return null;
    } finally {
      agentStore.setState((state) =>
        state.running?.cancel === cancel ? { ...state, running: null } : state,
      );
    }
  }

  return { run };
}

export type RunAgentCommand = ReturnType<typeof useAgent>["run"];
