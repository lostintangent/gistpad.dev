import introUrl from "./intro.mp3";
import {
  backgroundResult,
  DEFAULT_OPENAI_REALTIME_MODEL,
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  tool,
  type TransportEvent,
} from "@openai/agents/realtime";
import { z } from "zod";
import type { TalkConnection, TalkConnectionOptions } from "../talk/talk";
import type { TalkTool, TalkToolContext } from "../talk/tools";
import { createOpenAIClient } from "./client";

// Connects to the OpenAI realtime API, with the user's microphone, and plays the assistant's audio.
export async function openTalkConnection({
  instructions,
  voice,
  tools,
  getToolContext,
  onResponseStart,
  onSpeakingChange,
}: TalkConnectionOptions): Promise<TalkConnection> {
  const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
  const stopMicrophone = () => {
    for (const track of microphone.getTracks()) track.stop();
  };

  try {
    await new Audio(introUrl).play();

    const agent = new RealtimeAgent({
      name: "GistPad",
      instructions,
      voice,
      tools: tools.map((tool) => toRealtimeTool(tool, getToolContext)),
    });

    const session = new RealtimeSession(agent, {
      transport: new OpenAIRealtimeWebRTC({ mediaStream: microphone }),
      // The conversation isn't displayed (or traced), so it doesn't need to be transcribed. And
      // the microphone is usually a laptop's (or a headset's), which is near the user.
      config: {
        audio: { input: { transcription: null, noiseReduction: { type: "near_field" } } },
      },
      tracingDisabled: true,
    });

    session.on("transport_event", (event: TransportEvent) => {
      switch (event.type) {
        case "response.created":
          onResponseStart();
          break;
        case "output_audio_buffer.started":
          onSpeakingChange(true);
          break;
        case "output_audio_buffer.stopped":
          onSpeakingChange(false);
          break;
      }
    });

    await session.connect({ apiKey: createSessionKey });
    return toTalkConnection(session, stopMicrophone);
  } catch (error) {
    stopMicrophone();
    throw error;
  }
}

/**
 * Performs the tool call, and only asks the assistant to respond when the tool requests it (or fails).
 * Tools that change the user's gist fail for other people's gists (which may have been opened since
 * the conversation started).
 */
const toRealtimeTool = (
  { name, description, parameters, handler, requiresOwnership }: TalkTool,
  getToolContext: () => TalkToolContext,
) =>
  tool({
    name,
    description,
    parameters: parameters ?? z.object({}),
    execute: async (args) => {
      const context = getToolContext();
      if (requiresOwnership && context.file.isReadOnly) {
        return "Function call failed. This gist belongs to someone else (or the user isn't signed in), so it can't be changed. But the user can save their own copy of it, by saving it themselves (which offers to fork it).";
      }

      try {
        const result = await handler(args, context);
        const message = typeof result === "string" ? result : (result?.successMessage ?? "");
        const output = `Function call succeeded. ${message}`;

        return typeof result === "object" && result.requestResponse
          ? output
          : backgroundResult(output);
      } catch (error) {
        console.error(`Talk tool failed (${name}):`, error);
        return `Function call failed. ${error instanceof Error ? error.message : ""}`;
      }
    },
  });

// Adapts a realtime session (and the microphone that it uses) to a talk connection.
function toTalkConnection(session: RealtimeSession, stopMicrophone: () => void): TalkConnection {
  return {
    sendMessage: (text) => session.sendMessage(text),
    shareContext: (text) => session.transport.sendMessage(text, {}, { triggerResponse: false }),
    respond: () => session.transport.sendEvent({ type: "response.create" }),

    interrupt: () => session.interrupt(),
    mute: (isMuted) => session.mute(isMuted),
    close: () => {
      session.close();
      stopMicrophone();
    },
  };
}

// Creates a short-lived key for a session, which is how the SDK
// connects from a browser (and selects its model).
async function createSessionKey() {
  const { value } = await createOpenAIClient().realtime.clientSecrets.create({
    session: { type: "realtime", model: DEFAULT_OPENAI_REALTIME_MODEL },
  });

  return value;
}
