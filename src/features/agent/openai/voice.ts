import introUrl from "@/assets/intro.mp3";
import {
  backgroundResult,
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  tool,
} from "@openai/agents/realtime";
import { z } from "zod";
import { apiKeyAtom } from "../settings/modelSettings";
import type { VoiceTool, VoiceToolContext } from "../voice/tools";
import { createOpenAIClient } from "./client";

// Voice conversations use OpenAI's realtime API, over a WebRTC connection (where audio is
// streamed via media tracks, and events are exchanged over a data channel).

interface VoiceSessionOptions {
  instructions: string;
  voice: string;
  tools: VoiceTool[];
  /** Returns the latest state of the editor (when a tool is called). */
  getToolContext: () => VoiceToolContext;
}

export type VoiceSession = Awaited<ReturnType<typeof startVoiceSession>>;

/** Performs the tool call, and only asks the assistant to respond when the tool requests it (or fails). */
const toRealtimeTool = (
  { name, description, parameters, handler }: VoiceTool,
  getToolContext: () => VoiceToolContext,
) =>
  tool({
    name,
    description,
    parameters: parameters ?? z.object({}),
    execute: async (args) => {
      try {
        const result = await handler(args, getToolContext());
        const message = typeof result === "string" ? result : (result?.successMessage ?? "");
        const output = `Function call succeeded. ${message}`;

        return typeof result === "object" && result.requestResponse
          ? output
          : backgroundResult(output);
      } catch (error) {
        console.error(`Voice tool failed (${name}):`, error);
        return `Function call failed. ${error instanceof Error ? error.message : ""}`;
      }
    },
  });

/** Connects to the realtime API, with the user's microphone, and plays the assistant's audio. */
export async function startVoiceSession({
  instructions,
  voice,
  tools,
  getToolContext,
}: VoiceSessionOptions) {
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
      transport: new OpenAIRealtimeWebRTC({ mediaStream: microphone, useInsecureApiKey: true }),
      // The conversation isn't displayed (or traced), so it doesn't need to be transcribed. And
      // the microphone is usually a laptop's (or a headset's), which is near the user.
      config: {
        audio: { input: { transcription: null, noiseReduction: { type: "near_field" } } },
      },
      tracingDisabled: true,
    });
    await session.connect({ apiKey: apiKeyAtom.get() });

    return {
      session,
      close: () => {
        session.close();
        stopMicrophone();
      },
    };
  } catch (error) {
    stopMicrophone();
    throw error;
  }
}

/** Generates an image (as PNG data) from a prompt. */
export async function generateImage(prompt: string) {
  const response = await createOpenAIClient().images.generate({
    model: "gpt-image-2",
    prompt,
    size: "1024x1024",
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("No image was generated");

  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
}
