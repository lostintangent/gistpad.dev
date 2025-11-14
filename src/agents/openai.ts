import OpenAI from "openai";
import type { ResponseStream } from "openai/lib/responses/ResponseStream";
import type { GistComment } from "../lib/github";

export type CancellablePromise<T> = Promise<T> & {
  cancel: () => Promise<void>;
};

export interface AgentFollowUp {
  question: string;
  topic: string;
}

const defaultModel = "o3";
const defaultEditModel = "gpt-4.1";
export const OPENAI_MODELS = [
  { value: defaultEditModel, label: "GPT-4.1" },
  { value: defaultModel, label: defaultModel },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
  { value: "o3-high", label: "o3 (High)" },
  { value: "o3-pro", label: "o3-pro" },
  { value: "o4-mini", label: "o4 Mini" },
] as const;

export interface AdditionalReference {
  title: string;
  content: string;
}

export interface AgentContext {
  content?: string;
  description?: string;
  instructions?: string;
  userComments?: GistComment[];
  additionalReferences?: AdditionalReference[];
}

export function referencesAsContext(
  references?: AdditionalReference[]
): string {
  if (!references || references.length === 0) {
    return "";
  }

  const refs = references.map(
    (r) =>
      `\n<reference>\n<title>${r.title}</title>\n<content>\n${r.content}\n</content>\n</reference>`
  );

  return `\n<additional_references>${refs.join("\n")}\n</additional_references>`;
}

export function createOpenAIClient() {
  const apiKey = localStorage.getItem("gistpad-openai-key");
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  return openai;
}

type ModelType = "ask" | "review" | "edit" | "research";

export function getModelSetting(modelType: ModelType): string {
  const settingName = `gistpad-openai-${modelType}-model`;
  const model = localStorage.getItem(settingName);

  return model || (modelType === "edit" ? defaultEditModel : defaultModel);
}

export function getModelProperties(modelType: ModelType): {
  model: string;
  reasoning?: { effort?: "high"; summary?: "auto" };
} {
  let model: string = getModelSetting(modelType);

  const showReasoningSummaries = localStorage.getItem("gistpad-show-reasoning-summaries");
  const reasoningEnabled = showReasoningSummaries !== "false";

  const reasoning: { effort?: "high"; summary?: "auto" } = {};
  if ((model.startsWith("o") || model === "gpt-5") && reasoningEnabled) {
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
    </note>`
  );

  return `

<user_notes>

Here are some notes that I've taken about the document (which may include a reference to sections using a markdown blockquote), which may provide meaningful context and insight about the content:

${notes.join("\n")}

</user_notes>`;
}

export function buildAgentInput(
  prompt: string,
  context: AgentContext = {}
): string {
  const documentContext =
    context.content?.trim().length > 0
      ? `<current_document${context.description ? ` title="${context.description}"` : ""}>\n${context.content}\n</current_document>`
      : null;
  const instructionContext = context.instructions
    ? `<additional_instructions>${context.instructions}</additional_instructions>`
    : null;
  const userCommentsContext = userCommentsAsContext(context.userComments);
  const referencesContext = referencesAsContext(context.additionalReferences);

  return [
    `<request>${prompt}</request>`,
    documentContext,
    userCommentsContext,
    referencesContext,
    instructionContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateDalleImage(prompt: string): Promise<ArrayBuffer> {
  const openai = createOpenAIClient();

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    // Convert base64 to ArrayBuffer
    const base64 = response.data[0].b64_json;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("Error generating DALL-E image:", error);
    throw error;
  }
}

export async function* generateTitle(
  prompt: string,
  abortSignal?: AbortSignal
): AsyncGenerator<string> {
  const openai = createOpenAIClient();

  const stream = openai.responses.stream(
    {
      model: "gpt-4o",
      instructions:
        "Generate a concise title that summarizes the objective, request, and context in the user's message. Respond with nothing but the title, and prepend it with an emoji.",
      input: prompt,
    },
    { signal: abortSignal }
  );

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}

export function makeCancellable<T>(
  run: Promise<T>,
  stream: ResponseStream<T>,
  responseId: string
): CancellablePromise<T> {
  (run as any).cancel = async () => {
    stream.abort();
    if (responseId) {
      cancelResponse(responseId);
    }
  };

  return run as CancellablePromise<T>;
}

export async function cancelResponse(responseId: string): Promise<void> {
  try {
    const openai = createOpenAIClient();
    await openai.responses.cancel(responseId);
  } catch (error) {
    console.error("Error attempting to cancel response:", error);
  }
}

export function toAsyncIterable<T>(
  stream: ReadableStream<T>
): AsyncIterableIterator<T> {
  if ((stream as any)[Symbol.asyncIterator]) return stream as any;

  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done) reader.releaseLock();
        return result as IteratorResult<T>;
      } catch (e) {
        reader.releaseLock();
        throw e;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: undefined } as IteratorReturnResult<T>;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
