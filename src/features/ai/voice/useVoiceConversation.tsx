import introUrl from "@/assets/intro.mp3";
import { useDocumentContent, useSaveDocument, type GistDocument } from "@/features/editor/document";
import { useEditorMode } from "@/features/editor/mode";
import { useAddAndOpenFile, useCreateAndOpenGist } from "@/features/gists/actions";
import { getFileDisplayName, getGistDescription } from "@/shared/github";
import { parseFrontMatter } from "../frontMatter";
import { usePreferences } from "@/features/account/queries";
import { DEFAULT_VOICE, parseGlobalFrontMatter } from "../commands";
import { aiSettingsStore } from "../settings";
import { useMutation } from "@tanstack/react-query";
import type {
  RealtimeConversationItemFunctionCall as FunctionCall,
  RealtimeServerEvent as ServerEvent,
} from "openai/resources/realtime/realtime";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { AiCommands } from "../useAiCommands";
import { getToolDefinitions, getToolHandler, type VoiceToolContext } from "./tools";

// Voice conversations use OpenAI's realtime API, over a WebRTC connection (where audio is
// streamed via media tracks, and events are exchanged over a data channel).

const REALTIME_URL = "https://api.openai.com/v1/realtime?model=gpt-realtime";

function send(channel: RTCDataChannel, event: Record<string, unknown>) {
  if (channel.readyState === "open") channel.send(JSON.stringify(event));
}

const userMessage = (text: string) => ({
  type: "conversation.item.create",
  item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
});

/** Connects to the realtime API, with the user's microphone, and plays the assistant's audio. */
async function openConnection() {
  const peer = new RTCPeerConnection();
  let microphone: MediaStream | undefined;
  const close = () => {
    for (const track of microphone?.getTracks() ?? []) track.stop();
    peer.close();
  };

  try {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    peer.ontrack = (event) => (audio.srcObject = event.streams[0]);

    microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of microphone.getTracks()) peer.addTrack(track, microphone);

    await new Audio(introUrl).play();
    const channel = peer.createDataChannel("oai-events");

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const response = await fetch(REALTIME_URL, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${aiSettingsStore.state.apiKey}`,
        "Content-Type": "application/sdp",
      },
    });
    await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });

    return { channel, microphone, close };
  } catch (error) {
    close();
    throw error;
  }
}

/** A voice conversation about the open document, where the assistant can also use tools to edit it. */
export function useVoiceConversation(doc: GistDocument, ai: AiCommands) {
  const content = useDocumentContent(doc);
  const preferences = usePreferences();
  const [, setEditorMode] = useEditorMode();
  const addFile = useAddAndOpenFile();
  const createGist = useCreateAndOpenGist();
  const save = useSaveDocument(doc);

  const session = useMutation({
    mutationFn: openConnection,
    onError: (error) => console.error("Voice conversation error:", error),
    meta: { errorMessage: "Failed to start voice conversation." },
  });
  const connection = session.data;
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [whoIsSpeaking, setWhoIsSpeaking] = useState<"user" | "assistant" | null>(null);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);

  // The document that the assistant was last told about (so it can be told when it changes).
  const announcedDocumentRef = useRef<string | null>(null);

  const end = () => {
    session.reset();
    setIsMicMuted(false);
    setWhoIsSpeaking(null);
    setIsAwaitingResponse(false);
  };

  const setMicMuted = (isMuted: boolean) => {
    for (const track of connection?.microphone.getAudioTracks() ?? []) track.enabled = !isMuted;
    setIsMicMuted(isMuted);
  };

  const getToolContext = (): VoiceToolContext => ({
    doc,
    runCommand: async (command, mode) => {
      if (!(await ai.run(command, mode))) throw new Error(`The ${mode} command didn't complete.`);
    },
    addFile: (filename, content) => addFile(doc.gistId!, filename, content),
    createGist: (description, content) => createGist({ description, content }),
    save,
    setEditorMode,
    muteMicrophone: () => setMicMuted(true),
    endConversation: end,
  });

  /** Configures the assistant (based on the document's settings), and shares the document with it. */
  const startConversation = useEffectEvent((channel: RTCDataChannel) => {
    const { frontMatter, content: body } = parseFrontMatter(content);
    const talk = { ...parseGlobalFrontMatter(preferences).talk, ...frontMatter?.talk };

    const instructions = [
      talk.persona &&
        `For the duration of this conversation, you must behave in the following way: ${talk.persona}`,
      talk.instructions &&
        `Additionally, the following is your main objective that you must follow and pay close attention to: ${talk.instructions}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    send(channel, {
      type: "session.update",
      session: {
        instructions,
        voice: talk.voice || DEFAULT_VOICE,
        tools: getToolDefinitions({ canEdit: !doc.isReadOnly }),
      },
    });

    const files = Object.keys(doc.gist?.files ?? {})
      .map(
        (filename) =>
          `* ${getFileDisplayName(filename)}${filename === doc.filename ? " (current document)" : ""}`,
      )
      .join("\n");

    send(
      channel,
      userMessage(`Here's the contents of the file I'm working on, in a gist that's titled "${doc.gist ? getGistDescription(doc.gist) : ""}". If you were given an objective, then make sure to follow that precisely. Otherwise, greet me with a very quick intro that you're ready to talk about this document, and then wait for me to ask questions.
<document_contents>
${body}
</document_contents>

<file_list>
Additionally, the current gist includes the following files, which you may refer to if needed:

${files}
</file_list>`),
    );

    announcedDocumentRef.current = doc.documentKey;
    setTimeout(() => send(channel, { type: "response.create" }), 1000);
  });

  const callTool = useEffectEvent(async (channel: RTCDataChannel, call: FunctionCall) => {
    const respond = (output: string) =>
      send(channel, {
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: call.call_id, output },
      });

    try {
      const handler = getToolHandler(call.name);
      if (!handler) throw new Error(`There's no "${call.name}" function.`);

      const result = await handler(JSON.parse(call.arguments), getToolContext());
      const message = typeof result === "string" ? result : (result?.successMessage ?? "");
      respond(`Function call succeeded. ${message}`);

      if (typeof result === "object" && result?.requestResponse) {
        send(channel, { type: "response.create" });
      }
    } catch (error) {
      console.error(`Voice tool failed (${call.name}):`, error);
      respond(`Function call failed. ${error instanceof Error ? error.message : ""}`);
      send(channel, { type: "response.create" });
    }
  });

  const handleServerEvent = useEffectEvent((channel: RTCDataChannel, event: ServerEvent) => {
    switch (event.type) {
      case "response.done": {
        const [output] = event.response.output ?? [];
        if (output?.type === "function_call") {
          setIsAwaitingResponse(false);
          callTool(channel, output);
        }
        break;
      }
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

    const { channel } = connection;
    const onOpen = () => startConversation(channel);
    const onMessage = (event: MessageEvent) => handleServerEvent(channel, JSON.parse(event.data));

    if (channel.readyState === "open") onOpen();
    else channel.addEventListener("open", onOpen, { once: true });
    channel.addEventListener("message", onMessage);

    return () => {
      channel.removeEventListener("open", onOpen);
      channel.removeEventListener("message", onMessage);
      channel.close();
      connection.close();
      announcedDocumentRef.current = null;
    };
  }, [connection]);

  // Let the assistant know when the user opens a different document.
  const announceDocument = useEffectEvent((channel: RTCDataChannel) => {
    const previous = announcedDocumentRef.current;
    if (previous === null || previous === doc.documentKey || !doc.gist) return;

    announcedDocumentRef.current = doc.documentKey;
    send(
      channel,
      userMessage(`I've switched to a different document called "${doc.filename}" in a gist titled "${getGistDescription(doc.gist)}". Here are its contents:

\`\`\`markdown
${content}
\`\`\``),
    );
  });

  useEffect(() => {
    if (connection && !doc.isLoading) announceDocument(connection.channel);
  }, [connection, doc.documentKey, doc.isLoading]);

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
      send(connection.channel, { type: "response.cancel" });
      send(connection.channel, userMessage(command));
      send(connection.channel, { type: "response.create" });
    },
  };
}

export type VoiceConversation = ReturnType<typeof useVoiceConversation>;
