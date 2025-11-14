import { editorModeAtom } from "@/atoms";
import { GistComment } from "@/lib/github";
import { parseFrontMatter } from "@/lib/utils";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getBaseTools, getEditTools, getToolHandlers } from "./tools";
import { VoiceToolHandlerContext } from "./types";

export interface UseVoiceConversationProps {
  gistId?: string;
  selectedFile?: string;
  content: string;
  description: string;
  isLoading?: boolean;
  gist?: any; // Will need proper typing
  onSelectFile?: (filename: string) => void;
  onAddFile?: (
    gistId: string,
    filename: string,
    content?: string
  ) => Promise<void>;
  onCreateGist?: (description: string, content?: string) => void;
  onResearchTopic?: (
    topic: string,
    content: string,
    userComments?: GistComment[]
  ) => void;
  onReviewContent?: (request: string) => void;
  onEditContent: (request: string) => Promise<void>;
  isMobile?: boolean;
  handleSaveWithForkCheck?: () => Promise<void>;
  setIsAiCommandInProgress: (isInProgress: boolean) => void;
  setShowDeleteDialog: () => void;
  setCommentSidebarOpen: (open: boolean) => void;
  isReadOnly?: boolean;
  getGlobalFrontMatter?: () => {
    talk?: { persona?: string; voice?: string; instructions?: string };
  };
}

export function useVoiceConversation({
  gistId,
  selectedFile,
  content,
  description,
  onEditContent,
  isLoading,
  gist,
  onSelectFile,
  onAddFile,
  onCreateGist,
  onResearchTopic,
  onReviewContent,
  isMobile = false,
  handleSaveWithForkCheck,
  setIsAiCommandInProgress,
  setShowDeleteDialog,
  setCommentSidebarOpen,
  isReadOnly = false,
  getGlobalFrontMatter,
}: UseVoiceConversationProps) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [whoIsSpeaking, setWhoIsSpeaking] = useState<
    null | "user" | "assistant"
  >(null);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const setEditorMode = useSetAtom(editorModeAtom);

  const endVoiceConversation = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setIsVoiceActive(false);
    setIsMicMuted(false);
    setWhoIsSpeaking(null);
  }, []);

  // Effect to send gist info to voice conversation when switching documents
  useEffect(() => {
    if (
      gistId &&
      isVoiceActive &&
      dataChannelRef.current?.readyState === "open" &&
      !isLoading
    ) {
      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `I've switched to a different document called "${selectedFile}" in a gist titled "${description}". Here are its contents:

\`\`\`markdown
${content}
\`\`\`
              `,
            },
          ],
        },
      };

      dataChannelRef.current.send(JSON.stringify(event));
    }
  }, [gistId, selectedFile, isLoading, content, description, isVoiceActive]);

  // We need to keep the following callbacks in sync with the parent component,
  // and therefore, we're tracking refs for them all, which can be used
  // when constructing a new tool context, each time the a tool is called.
  const onSelectFileRef = useRef<typeof onSelectFile>(onSelectFile);
  const onCreateGistRef = useRef<typeof onCreateGist>(onCreateGist);
  const onAddFileRef = useRef<typeof onAddFile>(onAddFile);
  const onEditContentRef = useRef<typeof onEditContentRef>(onEditContent);
  const handleSaveWithForkCheckRef = useRef<typeof handleSaveWithForkCheck>(
    handleSaveWithForkCheck
  );
  const onResearchTopicRef = useRef<typeof onResearchTopic>(onResearchTopic);
  const onReviewContentRef = useRef<typeof onReviewContent>(onReviewContent);
  const setCommentSidebarOpenRef = useRef<typeof setCommentSidebarOpen>(
    setCommentSidebarOpen
  );

  useEffect(() => {
    onSelectFileRef.current = onSelectFile;
    onCreateGistRef.current = onCreateGist;
    onAddFileRef.current = onAddFile;
    onEditContentRef.current = onEditContent;
    handleSaveWithForkCheckRef.current = handleSaveWithForkCheck;
    onResearchTopicRef.current = onResearchTopic;
    onReviewContentRef.current = onReviewContent;
    setCommentSidebarOpenRef.current = setCommentSidebarOpen;
  }, [
    onSelectFile,
    onCreateGist,
    onAddFile,
    onEditContent,
    handleSaveWithForkCheck,
    onResearchTopic,
    onReviewContent,
    setCommentSidebarOpen,
  ]);

  const startVoiceConversation = async () => {
    if (isVoiceActive) {
      endVoiceConversation();
      return;
    }

    try {
      // Parse frontmatter from current content
      const { frontMatter, content: contentWithoutFrontMatter } =
        parseFrontMatter(content);
      const globalFrontmatter = getGlobalFrontMatter?.();

      const persona =
        frontMatter?.talk?.persona || globalFrontmatter?.talk?.persona;
      const objective =
        frontMatter?.talk?.instructions ||
        globalFrontmatter?.talk?.instructions;
      const voice =
        frontMatter?.talk?.voice || globalFrontmatter?.talk?.voice || "alloy";

      // 2. Create a peer connection.
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // 3. Set up remote audio playback.
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // 4. Get microphone access and add the local audio track.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const audio = new Audio("./intro.mp3");
      await audio.play();

      // 5. Create a data channel for sending events.
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.addEventListener("open", async () => {
        let instructions = "";

        if (persona)
          instructions = `For the duration of this conversation, you must behave in the following way: ${persona}`;

        if (objective)
          instructions += `\n\nAdditionally, the following is your main objective that you must follow and pay close attention to: ${objective}`;

        const tools = getBaseTools();
        if (!isReadOnly) {
          tools.push(...getEditTools());
        }

        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions,
              voice,
              tools,
            },
          })
        );

        // Send the file contents
        const event = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Here's the contents of the file I'm working on, in a gist that's titled "${description}". If you were given an objective, then make sure to follow that precisely. Otherwise, greet me with a very quick intro that you're ready to talk about this document, and then wait for me to ask questions.
<document_contents>
${contentWithoutFrontMatter}
</document_contents>


<file_list>
Additionally, the current gist includes the following files, which you may refer to if needed:

${Object.keys(gist?.files || {}).map((filename) => "* " + filename.replace(".md", "") + (filename === selectedFile ? " (current document)" : "") + "\n")}
</file_list>
        `,
              },
            ],
          },
        };

        dc.send(JSON.stringify(event));

        const handleMessage = async (e: MessageEvent) => {
          const eventData = JSON.parse(e.data);
          if (eventData.type === "response.done") {
            if (
              eventData.response.output &&
              eventData.response.output.length > 0 &&
              eventData.response.output[0].type === "function_call"
            ) {
              setIsAiCommandInProgress(false);
              const eventOutput = eventData.response.output[0];

              const toolContext: VoiceToolHandlerContext = {
                gistId,
                content,
                editContent: onEditContentRef.current,
                openFile: onSelectFileRef.current,
                addFile: (filename: string, content?: string) =>
                  onAddFileRef.current(gistId, filename, content),
                createGist: onCreateGistRef.current,
                reviewContent: (request: string) =>
                  onReviewContentRef.current?.(request),
                performResearch: (topic: string) =>
                  onResearchTopicRef.current?.(topic, content),
                saveGist: handleSaveWithForkCheckRef.current,
                setEditorMode,
                setCommentSidebarOpen: (open: boolean) =>
                  setCommentSidebarOpenRef.current(open),
                deleteGist: setShowDeleteDialog,
                isMobile,
                audioStream: audioStreamRef.current,
                muteMic: () => setIsMicMuted(true),
                endVoiceConversation,
              };

              const handlers = getToolHandlers();
              const handler = handlers[eventOutput.name];
              if (handler) {
                const args = JSON.parse(eventOutput.arguments);
                const result = await handler(args, toolContext);

                const sucessMessage =
                  typeof result === "string"
                    ? result
                    : (result && result.successMessage) || "";

                const requestResponse =
                  typeof result === "object" ? result?.requestResponse : false;

                dataChannelRef.current?.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: eventOutput.call_id,
                      output: `Function call succeeded. ${sucessMessage}`,
                    },
                  })
                );

                if (requestResponse) {
                  dataChannelRef.current?.send(
                    JSON.stringify({
                      type: "response.create",
                    })
                  );
                }
              }
            }
          } else if (eventData.type === "output_audio_buffer.started") {
            setIsAiCommandInProgress(false);
            setWhoIsSpeaking("assistant");
          } else if (eventData.type === "input_audio_buffer.speech_started") {
            setWhoIsSpeaking("user");
          } else if (eventData.type === "output_audio_buffer.stopped") {
            setWhoIsSpeaking(null);
            setIsAiCommandInProgress(false);
          } else if (eventData.type === "input_audio_buffer.speech_stopped") {
            setWhoIsSpeaking(null);
          }
        };

        dataChannelRef.current.addEventListener("message", handleMessage);

        setTimeout(() => {
          dc.send(
            JSON.stringify({
              type: "response.create",
            })
          );
        }, 1000);
      });

      // 6. Create an SDP offer and set local description.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Start the session with OpenAI's realtime server.
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-realtime";
      const apiKey = localStorage.getItem("gistpad-openai-key");
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/sdp",
        },
      });

      // 8. Set remote description from the SDP answer.
      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      } as const;
      await pc.setRemoteDescription(answer);

      setIsVoiceActive(true);
    } catch (error) {
      endVoiceConversation();
      console.error("Voice conversation error:", error);
      toast.error("Failed to start voice conversation.");
    }
  };

  const muteMicrophone = useCallback(() => {
    if (audioStreamRef.current) {
      const audioTrack = audioStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicMuted(!audioTrack.enabled);
    }
  }, []);

  const sendVoiceCommand = useCallback(
    (command: string) => {
      if (dataChannelRef.current?.readyState === "open") {
        const event = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: command,
              },
            ],
          },
        };

        dataChannelRef.current.send(
          JSON.stringify({
            type: "response.cancel",
          })
        );

        dataChannelRef.current.send(JSON.stringify(event));
        dataChannelRef.current.send(
          JSON.stringify({
            type: "response.create",
          })
        );
      }
    },
    [isVoiceActive]
  );

  useEffect(() => {
    return () => {
      endVoiceConversation();
    };
  }, [endVoiceConversation]);

  return {
    startVoiceConversation,
    endVoiceConversation,
    isVoiceActive,
    muteMicrophone,
    isMicMuted,
    whoIsSpeaking,
    sendVoiceCommand,
  };
}
