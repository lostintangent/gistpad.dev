import { createStore, useSelector } from "@tanstack/react-store";

// The user's OpenAI settings, which only ever live in this browser's localStorage
// (using the same keys as previous versions of the app).

export type ModelType = "ask" | "edit" | "review" | "research";

export const OPENAI_MODELS = [
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "o3", label: "o3" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
  { value: "o3-high", label: "o3 (High)" },
  { value: "o3-pro", label: "o3-pro" },
  { value: "o4-mini", label: "o4 Mini" },
] as const;

const DEFAULT_MODELS: Record<ModelType, string> = {
  ask: "o3",
  edit: "gpt-4.1",
  review: "o3",
  research: "o3",
};

export interface AiSettings {
  apiKey: string;
  models: Record<ModelType, string>;
  showReasoningSummaries: boolean;
}

const API_KEY = "gistpad-openai-key";
const REASONING_SUMMARIES_KEY = "gistpad-show-reasoning-summaries";
const modelKey = (type: ModelType) => `gistpad-openai-${type}-model`;
const modelTypes = Object.keys(DEFAULT_MODELS) as ModelType[];

export const aiSettingsStore = createStore<AiSettings>({
  apiKey: localStorage.getItem(API_KEY) ?? "",
  models: Object.fromEntries(
    modelTypes.map((type) => [type, localStorage.getItem(modelKey(type)) || DEFAULT_MODELS[type]]),
  ) as Record<ModelType, string>,
  showReasoningSummaries: localStorage.getItem(REASONING_SUMMARIES_KEY) !== "false",
});

aiSettingsStore.subscribe(({ apiKey, models, showReasoningSummaries }) => {
  if (apiKey) localStorage.setItem(API_KEY, apiKey);
  else localStorage.removeItem(API_KEY);

  for (const type of modelTypes) localStorage.setItem(modelKey(type), models[type]);
  localStorage.setItem(REASONING_SUMMARIES_KEY, String(showReasoningSummaries));
});

export const useIsAiEnabled = () => useSelector(aiSettingsStore, ({ apiKey }) => !!apiKey);
