import { createStore, useSelector } from "@tanstack/react-store";
import type { AiMode } from "./commands";

// The user's OpenAI settings, which only ever live in this browser's localStorage
// (using the same keys as previous versions of the app).

export const OPENAI_MODELS = [
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "o3", label: "o3" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
  { value: "o3-high", label: "o3 (High)" },
  { value: "o3-pro", label: "o3-pro" },
  { value: "o4-mini", label: "o4 Mini" },
] as const;

const DEFAULT_MODELS: Record<AiMode, string> = {
  ask: "o3",
  edit: "gpt-4.1",
  review: "o3",
  research: "o3",
};

const API_KEY = "gistpad-openai-key";
const REASONING_SUMMARIES_KEY = "gistpad-show-reasoning-summaries";
const modelKey = (mode: AiMode) => `gistpad-openai-${mode}-model`;
const modes = Object.keys(DEFAULT_MODELS) as AiMode[];

export const aiSettingsStore = createStore({
  apiKey: localStorage.getItem(API_KEY) ?? "",
  models: Object.fromEntries(
    modes.map((mode) => [mode, localStorage.getItem(modelKey(mode)) || DEFAULT_MODELS[mode]]),
  ) as Record<AiMode, string>,
  showReasoningSummaries: localStorage.getItem(REASONING_SUMMARIES_KEY) !== "false",
});

aiSettingsStore.subscribe(({ apiKey, models, showReasoningSummaries }) => {
  if (apiKey) localStorage.setItem(API_KEY, apiKey);
  else localStorage.removeItem(API_KEY);

  for (const mode of modes) localStorage.setItem(modelKey(mode), models[mode]);
  localStorage.setItem(REASONING_SUMMARIES_KEY, String(showReasoningSummaries));
});

export const useIsAiEnabled = () => useSelector(aiSettingsStore, ({ apiKey }) => !!apiKey);
