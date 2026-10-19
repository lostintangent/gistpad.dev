import OpenAI from "openai";
import { apiKeyAtom } from "../settings/modelSettings";

export function createOpenAIClient(apiKey = apiKeyAtom.get()) {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

/**
 * Whether a model can power the agent, which excludes models that are specialized for other tasks
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

/** The IDs of the models that an API key can use for the agent (newest first). */
export async function listModels(apiKey: string, signal?: AbortSignal) {
  const models: OpenAI.Model[] = [];
  for await (const model of createOpenAIClient(apiKey).models.list({ signal })) {
    if (isAgentModel(model)) models.push(model);
  }

  return models.sort((a, b) => b.created - a.created).map(({ id }) => id);
}
