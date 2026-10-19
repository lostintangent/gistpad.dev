import { useEditorMode } from "@/features/editor/mode";
import { useFileContent, useSaveFile, type ActiveFile } from "@/features/files/file";
import { useAddAndOpenFile, useCreateAndOpenGist } from "@/features/gists/actions";
import { splitFrontMatter } from "@/shared/frontMatter";
import { getFileDisplayName, getGistDescription } from "@/shared/github";
import type { TransportEvent } from "@openai/agents/realtime";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { RunAgentCommand } from "../model/useAgent";
import type { VoiceSession } from "../openai";
import { useAgentSettings } from "../settings/useAgentSettings";
import type { VoiceToolContext } from "./tools";

/** A voice conversation about the active file, where the assistant can also use tools to edit it. */
export function useVoiceConversation(file: ActiveFile, run: RunAgentCommand) {
  const content = useFileContent(file);
  const { talk } = useAgentSettings(file);
  const [, setEditorMode] = useEditorMode();
  const addFile = useAddAndOpenFile();
  const createGist = useCreateAndOpenGist();
  const save = useSaveFile(file);

  // The latest editor state, for the tools that the assistant calls during the conversation.
  const toolContextRef = useRef<VoiceToolContext | null>(null);

  const session = useMutation({
    mutationFn: async () => {
      const instructions = [
        talk.persona &&
          `For the duration of this conversation, you must behave in the following way: ${talk.persona}`,
        talk.instructions &&
          `Additionally, the following is your main objective that you must follow and pay close attention to: ${talk.instructions}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const [{ startVoiceSession }, { getVoiceTools }] = await Promise.all([
        import("../openai"),
        import("./tools"),
      ]);
      return startVoiceSession({
        instructions,
        voice: talk.voice,
        tools: getVoiceTools({ canEdit: !file.isReadOnly }),
        getToolContext: () => toolContextRef.current!,
      });
    },
    onError: (error) => console.error("Voice conversation error:", error),
    meta: { errorMessage: "Failed to start voice conversation." },
  });
  const connection = session.data;
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [whoIsSpeaking, setWhoIsSpeaking] = useState<"user" | "assistant" | null>(null);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);

  // The file that the assistant was last told about (so it can be told when it changes).
  const announcedFileRef = useRef<string | null>(null);

  const end = () => {
    session.reset();
    setIsMicMuted(false);
    setWhoIsSpeaking(null);
    setIsAwaitingResponse(false);
  };

  const setMicMuted = (isMuted: boolean) => {
    connection?.session.mute(isMuted);
    setIsMicMuted(isMuted);
  };

  useEffect(() => {
    toolContextRef.current = {
      file,
      runCommand: async (command, mode) => {
        if (!(await run(command, mode))) throw new Error(`The ${mode} command didn't complete.`);
      },
      addFile: (filename, content) => addFile(file.gistId!, filename, content),
      createGist: (description, content) => createGist({ description, content }),
      save,
      setEditorMode,
      muteMicrophone: () => setMicMuted(true),
      endConversation: end,
    };
  });

  /** Shares the file with the assistant, and then asks it to start the conversation. */
  const startConversation = useEffectEvent(({ session }: VoiceSession) => {
    const { content: body } = splitFrontMatter(content);
    const files = Object.keys(file.gist?.files ?? {})
      .map(
        (filename) =>
          `* ${getFileDisplayName(filename)}${filename === file.filename ? " (current document)" : ""}`,
      )
      .join("\n");

    session.transport.sendMessage(
      `Here's the contents of the file I'm working on, in a gist that's titled "${file.gist ? getGistDescription(file.gist) : ""}". If you were given an objective, then make sure to follow that precisely. Otherwise, greet me with a very quick intro that you're ready to talk about this document, and then wait for me to ask questions.
<document_contents>
${body}
</document_contents>

<file_list>
Additionally, the current gist includes the following files, which you may refer to if needed:

${files}
</file_list>`,
      {},
      { triggerResponse: false },
    );

    announcedFileRef.current = file.key;

    // Give the intro sound a moment to finish before the assistant starts talking.
    return setTimeout(() => session.transport.sendEvent({ type: "response.create" }), 1000);
  });

  const handleTransportEvent = useEffectEvent((event: TransportEvent) => {
    switch (event.type) {
      case "output_audio_buffer.started":
        setIsAwaitingResponse(false);
        setWhoIsSpeaking("assistant");
        break;
      case "output_audio_buffer.stopped":
        setIsAwaitingResponse(false);
        setWhoIsSpeaking(null);
        break;
      case "input_audio_buffer.speech_started":
        setWhoIsSpeaking("user");
        break;
      case "input_audio_buffer.speech_stopped":
        setWhoIsSpeaking(null);
        break;
    }
  });

  // The connection's lifetime is tied to the session's data (i.e. resetting the session closes it).
  useEffect(() => {
    if (!connection) return;

    const onTransportEvent = (event: TransportEvent) => handleTransportEvent(event);
    const onToolStart = () => setIsAwaitingResponse(false);
    connection.session.on("transport_event", onTransportEvent);
    connection.session.on("agent_tool_start", onToolStart);
    const responseTimeout = startConversation(connection);

    return () => {
      clearTimeout(responseTimeout);
      connection.session.off("transport_event", onTransportEvent);
      connection.session.off("agent_tool_start", onToolStart);
      connection.close();
      announcedFileRef.current = null;
    };
  }, [connection]);

  // Let the assistant know when the user opens a different file.
  const announceFile = useEffectEvent(({ session }: VoiceSession) => {
    const previous = announcedFileRef.current;
    if (previous === null || previous === file.key || !file.gist) return;

    announcedFileRef.current = file.key;
    session.transport.sendMessage(
      `I've switched to a different document called "${file.filename}" in a gist titled "${getGistDescription(file.gist)}". Here are its contents:

\`\`\`markdown
${content}
\`\`\``,
      {},
      { triggerResponse: false },
    );
  });

  useEffect(() => {
    if (connection && !file.isLoading) announceFile(connection);
  }, [connection, file.key, file.isLoading]);

  return {
    isActive: !!connection,
    isMicMuted,
    whoIsSpeaking,
    /** Whether the assistant is responding to a (typed) command. */
    isAwaitingResponse,

    /** Starts a conversation (or ends the current one). */
    start: () => {
      if (connection) end();
      else if (!session.isPending) session.mutate();
    },
    end,
    toggleMute: () => setMicMuted(!isMicMuted),

    /** Sends a (typed) command to the assistant, interrupting it if it's speaking. */
    sendCommand: (command: string) => {
      if (!connection) return;

      setIsAwaitingResponse(true);
      connection.session.interrupt();
      connection.session.sendMessage(command);
    },
  };
}

export type VoiceConversation = ReturnType<typeof useVoiceConversation>;
