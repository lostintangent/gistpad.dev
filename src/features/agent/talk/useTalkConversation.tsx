import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { useEditorMode } from "@/features/workbench/layout/mode";
import { readFileContent, useSaveFile, type ActiveFile } from "@/features/files/file";
import { useAddAndOpenFile, useCreateAndOpenGist } from "@/features/gists/actions";
import { splitFrontMatter } from "@/shared/frontMatter";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { documentAsContext, toAgentDocument, userCommentsAsContext } from "../model/context";
import type { AgentMode } from "../model/modes";
import type { AgentRunResult, RunAgentCommand } from "../model/useAgent";
import { useAgentSettings } from "../settings/useAgentSettings";
import type { TalkSession } from "./session";
import type { TalkToolContext } from "./tools";

const MAX_RESULT_LENGTH = 4000;

const truncate = (text: string) =>
  text.length > MAX_RESULT_LENGTH ? `${text.slice(0, MAX_RESULT_LENGTH)}…` : text;

/** Describes the result of a command (which is displayed to the user), so the assistant can discuss it. */
function describeResult(result: AgentRunResult, mode: AgentMode) {
  switch (result.mode) {
    case "ask": {
      if (!result.answer) return "The agent didn't respond.";

      const label =
        mode === "ask" ? "This answer" : "Instead, the agent responded with this answer";
      return `${label} (which is displayed to the user):\n${truncate(result.answer.text)}`;
    }
    case "review": {
      const { title, comments } = result.review;
      const review = [
        title,
        ...comments.map(
          ({ heading, comment }) => `* ${[heading, comment].filter(Boolean).join(": ")}`,
        ),
      ];
      return `These review comments are displayed to the user:\n${truncate(review.filter(Boolean).join("\n"))}`;
    }
    case "edit":
      return "The document was edited, but the edit is pending until the user accepts it (and it isn't saved).";
    case "research":
      return "The research task was started, and its results will be added to the gist once it's complete.";
  }
}

/** A voice conversation about the active file, where the assistant can also use tools to edit it. */
export function useTalkConversation(file: ActiveFile, run: RunAgentCommand) {
  const settings = useAgentSettings(file);
  const { comments } = useCommentThreads(file);
  const [, setEditorMode] = useEditorMode();
  const addFile = useAddAndOpenFile();
  const createGist = useCreateAndOpenGist();
  const save = useSaveFile(file);

  // The latest editor state, for the tools that the assistant calls during the conversation.
  const toolContextRef = useRef<TalkToolContext | null>(null);

  const connect = useMutation({
    mutationFn: async () => {
      const [{ startTalkSession }, { talkTools }, { getTalkInstructions }] = await Promise.all([
        import("../openai"),
        import("./tools"),
        import("./instructions"),
      ]);
      return startTalkSession({
        instructions: getTalkInstructions({
          general: settings.general.instructions,
          persona: settings.talk.persona,
          objective: settings.talk.instructions,
        }),
        voice: settings.talk.voice,
        tools: talkTools,
        getToolContext: () => toolContextRef.current!,
      });
    },
    onError: (error) => console.error("Voice conversation error:", error),
    meta: { errorMessage: "Failed to start voice conversation." },
  });
  const connection = connect.data;
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [whoIsSpeaking, setWhoIsSpeaking] = useState<"user" | "assistant" | null>(null);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);

  // The document and notes that were last shared with the assistant (and in which conversation),
  // so they're only shared again when they change. And the timer that starts the conversation.
  const sharedContextRef = useRef<{
    conversation: TalkSession;
    fileKey: string;
    document: string;
    notes: string;
  } | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  /**
   * What's changed about the document (and the user's notes about it) since it was last shared in
   * the conversation. Notes are shared with each newly opened document (since they're about it), and
   * on their own when they change (e.g. once they've loaded).
   */
  const takeContextUpdate = useEffectEvent((conversation: TalkSession) => {
    // The conversation may have ended (e.g. while the agent was editing), or the file may be loading
    if (conversation !== connection || !file.gist || file.isLoading) return null;

    const { content: body } = splitFrontMatter(readFileContent(file));
    const document = documentAsContext(toAgentDocument(file, body));
    const notes = userCommentsAsContext(comments);

    const previous = sharedContextRef.current;
    const shared = previous?.conversation === conversation ? previous : null;
    sharedContextRef.current = { conversation, fileKey: file.key, document, notes };

    const isNewFile = shared?.fileKey !== file.key;
    const update = [
      document !== shared?.document && document,
      (isNewFile || notes !== shared?.notes) && notes,
    ];
    return update.filter(Boolean).join("\n\n") || null;
  });

  /** Shares the document with the assistant (if it changed), and the first time, starts the conversation. */
  const shareContext = useEffectEvent((conversation: TalkSession) => {
    const update = takeContextUpdate(conversation);
    if (update) conversation.shareContext(update);

    // Give the intro sound a moment to finish before the assistant starts talking.
    startTimerRef.current ??= setTimeout(() => conversation.respond(), 1000);
  });

  const end = () => {
    connect.reset();
    setIsMicMuted(false);
    setWhoIsSpeaking(null);
    setIsAwaitingResponse(false);
  };

  const setMicMuted = (isMuted: boolean) => {
    connection?.mute(isMuted);
    setIsMicMuted(isMuted);
  };

  useEffect(() => {
    toolContextRef.current = {
      file,
      runCommand: async (command, mode) => {
        const result = await run(command, mode);
        if (!result) throw new Error(`The ${mode} command didn't complete.`);

        // The updated document is part of the edit's result (rather than a separate message), so that
        // the assistant has it as soon as the edit is done.
        const update = result.mode === "edit" && connection ? takeContextUpdate(connection) : null;
        return {
          successMessage: [
            describeResult(result, mode),
            update && `The updated document:\n${update}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
          // When the agent didn't do what it was asked (e.g. it asked for clarification instead of
          // editing), the assistant lets the user know.
          requestResponse: result.mode !== mode || (result.mode === "ask" && !result.answer),
        };
      },
      addFile: (filename, content) => addFile(file.gistId!, filename, content),
      createGist: (description, content) => createGist({ description, content }),
      save,
      setEditorMode,
      muteMicrophone: () => setMicMuted(true),
      endConversation: end,
    };
  });

  // The connection's lifetime is tied to the mutation's data (i.e. resetting it closes the connection).
  useEffect(() => {
    if (!connection) return;

    const unsubscribe = connection.subscribe({
      onAssistantSpeaking: (isSpeaking) => {
        setIsAwaitingResponse(false);
        setWhoIsSpeaking(isSpeaking ? "assistant" : null);
      },
      onUserSpeaking: (isSpeaking) => setWhoIsSpeaking(isSpeaking ? "user" : null),
      onToolStart: () => setIsAwaitingResponse(false),
    });

    return () => {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = undefined;
      unsubscribe();
      connection.close();
    };
  }, [connection]);

  // Share the document once it's loaded, and whenever the user opens a different one (or its notes change).
  useEffect(() => {
    if (connection && !file.isLoading) shareContext(connection);
  }, [connection, file.key, file.isLoading, comments]);

  return {
    isActive: !!connection,
    isConnecting: connect.isPending,
    isMicMuted,
    whoIsSpeaking,
    /** Whether the assistant is responding to a (typed) command. */
    isAwaitingResponse,

    /** Starts a conversation (or ends the current one). */
    start: () => {
      if (connection) end();
      else if (!connect.isPending) connect.mutate();
    },
    end,
    toggleMute: () => setMicMuted(!isMicMuted),

    /** Sends a (typed) command to the assistant, interrupting it if it's speaking. */
    sendCommand: (command: string) => {
      if (!connection) return;

      setIsAwaitingResponse(true);
      connection.interrupt();
      connection.sendMessage(command);
    },
  };
}

export type TalkConversation = ReturnType<typeof useTalkConversation>;
