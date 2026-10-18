import type { GistComment } from "@/shared/github";
import type { AiMode } from "../commands";
import { aiSettingsStore } from "../settings";
import OpenAI from "openai";

export interface AgentFollowUp {
  question: string;
  topic: string;
}

export interface AdditionalReference {
  title: string;
  content: string;
}

/** The inputs that are common to all agent requests about a document. */
export interface AgentRequest {
  /** The user's request (e.g. a question to answer, or an edit to make). */
  prompt: string;
  /** The document (or selected text) that the request is about. */
  content?: string;
  /** The document's title. */
  description?: string;
  /** Custom instructions, from the document's (and the user's global) AI settings. */
  instructions?: string;
  /** Other documents that the user referenced in their request. */
  references?: AdditionalReference[];
  userComments?: GistComment[];
  /** The previous response in the conversation, which allows refining a request. */
  previousResponseId?: string;
  signal?: AbortSignal;
}

export function referencesAsContext(references?: AdditionalReference[]) {
  if (!references?.length) return "";

  const refs = references.map(
    (r) =>
      `\n<reference>\n<title>${r.title}</title>\n<content>\n${r.content}\n</content>\n</reference>`,
  );

  return `\n<additional_references>${refs.join("\n")}\n</additional_references>`;
}

export function createOpenAIClient(apiKey = aiSettingsStore.state.apiKey) {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

/**
 * Whether a model can power the agents, which excludes models that are specialized for other tasks
 * (e.g. audio, images, and coding), dated snapshots of models, and models that are being shut down.
 */
function isAgentModel({ id, shutdown_date }: OpenAI.Model) {
  return (
    /^(gpt-\d|o\d)/.test(id) &&
    !/audio|realtime|transcribe|tts|image|search|codex|chat|instruct|cyber/.test(id) &&
    !/-\d{4}(-\d{2}-\d{2})?$/.test(id) &&
    !shutdown_date
  );
}

/** The IDs of the models that an API key can use for the agents (newest first). */
export async function listModels(apiKey: string, signal?: AbortSignal) {
  const models: OpenAI.Model[] = [];
  for await (const model of createOpenAIClient(apiKey).models.list({ signal })) {
    if (isAgentModel(model)) models.push(model);
  }

  return models.sort((a, b) => b.created - a.created).map(({ id }) => id);
}

/** The model that the user has chosen for a mode (whose reasoning is summarized while it streams). */
export function getModelProperties(mode: AiMode) {
  return {
    model: aiSettingsStore.state.models[mode],
    reasoning: { summary: "auto" as const },
  };
}

export function userCommentsAsContext(comments?: GistComment[]) {
  if (!comments?.length) return "";

  const notes = comments.map(
    (comment) => `
    <note>
        ${comment.body}
    </note>`,
  );

  return `

<user_notes>

Here are some notes that I've taken about the document (which may include a reference to sections using a markdown blockquote), which may provide meaningful context and insight about the content:

${notes.join("\n")}

</user_notes>`;
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

export async function cancelResponse(responseId: string) {
  try {
    await createOpenAIClient().responses.cancel(responseId);
  } catch (error) {
    console.error("Error attempting to cancel response:", error);
  }
}
