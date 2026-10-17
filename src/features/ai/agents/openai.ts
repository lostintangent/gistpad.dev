import type { GistComment } from "@/shared/github";
import { aiSettingsStore, type ModelType } from "../settings";
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

export function referencesAsContext(references?: AdditionalReference[]): string {
  if (!references || references.length === 0) {
    return "";
  }

  const refs = references.map(
    (r) =>
      `\n<reference>\n<title>${r.title}</title>\n<content>\n${r.content}\n</content>\n</reference>`,
  );

  return `\n<additional_references>${refs.join("\n")}\n</additional_references>`;
}

export function createOpenAIClient() {
  return new OpenAI({ apiKey: aiSettingsStore.state.apiKey, dangerouslyAllowBrowser: true });
}

export function getModelProperties(modelType: ModelType): {
  model: string;
  reasoning?: { effort?: "high"; summary?: "auto" };
} {
  const { models, showReasoningSummaries } = aiSettingsStore.state;
  let model = models[modelType];

  const reasoning: { effort?: "high"; summary?: "auto" } = {};
  if ((model.startsWith("o") || model === "gpt-5") && showReasoningSummaries) {
    reasoning.summary = "auto";
  }

  if (model.endsWith("-high")) {
    model = model.slice(0, -5);
    reasoning.effort = "high";
  }

  return Object.keys(reasoning).length > 0 ? { model, reasoning } : { model };
}

export function userCommentsAsContext(comments?: GistComment[]): string {
  if (!comments || comments.length === 0) {
    return "";
  }

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

export function buildAgentInput(request: AgentRequest): string {
  const { prompt, content, description, instructions, userComments, references } = request;

  const documentContext = content?.trim()
    ? `<current_document${description ? ` title="${description}"` : ""}>\n${content}\n</current_document>`
    : null;
  const instructionContext = instructions
    ? `<additional_instructions>${instructions}</additional_instructions>`
    : null;

  return [
    `<request>${prompt}</request>`,
    documentContext,
    userCommentsAsContext(userComments),
    referencesAsContext(references),
    instructionContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Generates an image (as PNG data) from a prompt. */
export async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const response = await createOpenAIClient().images.generate({
    model: "gpt-image-2",
    prompt,
    size: "1024x1024",
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("No image was generated");

  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
}

export async function* generateTitle(
  prompt: string,
  abortSignal?: AbortSignal,
): AsyncGenerator<string> {
  const openai = createOpenAIClient();

  const stream = openai.responses.stream(
    {
      model: "gpt-4o",
      instructions:
        "Generate a concise title that summarizes the objective, request, and context in the user's message. Respond with nothing but the title, and prepend it with an emoji.",
      input: prompt,
    },
    { signal: abortSignal },
  );

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}

export async function cancelResponse(responseId: string): Promise<void> {
  try {
    const openai = createOpenAIClient();
    await openai.responses.cancel(responseId);
  } catch (error) {
    console.error("Error attempting to cancel response:", error);
  }
}
