import { createStore, useSelector } from "@tanstack/react-store";
import type { AiMode } from "./commands";

// The user's OpenAI settings, which only ever live in this browser's localStorage.

// The models that users can choose from are loaded from their OpenAI account (see `listModels`).
// Quick, supporting tasks (e.g. classifying a request's mode) also use the edit model.
const DEFAULT_MODELS: Record<AiMode, string> = {
  ask: "gpt-6.1-sol",
  edit: "gpt-6-luna",
  review: "gpt-6.1-sol",
  research: "gpt-6.1-sol",
};

const API_KEY = "gistpad-openai-key";
const modelKey = (mode: AiMode) => `gistpad-${mode}-model`;
const modes = Object.keys(DEFAULT_MODELS) as AiMode[];

export const aiSettingsStore = createStore({
  apiKey: localStorage.getItem(API_KEY) ?? "",
  models: Object.fromEntries(
    modes.map((mode) => [mode, localStorage.getItem(modelKey(mode)) || DEFAULT_MODELS[mode]]),
  ) as Record<AiMode, string>,
});

aiSettingsStore.subscribe(({ apiKey, models }) => {
  if (apiKey) localStorage.setItem(API_KEY, apiKey);
  else localStorage.removeItem(API_KEY);

  for (const mode of modes) localStorage.setItem(modelKey(mode), models[mode]);
});

export const useIsAiEnabled = () => useSelector(aiSettingsStore, ({ apiKey }) => !!apiKey);
