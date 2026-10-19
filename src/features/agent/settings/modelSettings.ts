import { persistedAtom, RAW_STRING } from "@/shared/persistedAtom";
import { useSelector } from "@tanstack/react-store";

// The user's OpenAI settings, which only ever live in this browser's localStorage. Its models are
// chosen from the ones that their API key can use (see `listModels`).

export const apiKeyAtom = persistedAtom("gistpad-openai-key", "", RAW_STRING);

/** The model that the agent uses to answer questions, and edit and review files. */
export const agentModelAtom = persistedAtom("gistpad-agent-model", "gpt-6-luna", RAW_STRING);

/** The model that performs in-depth (and long-running) work: research, and analyzing writing styles. */
export const researchModelAtom = persistedAtom("gistpad-research-model", "gpt-6.1-sol", RAW_STRING);

export const useIsAgentEnabled = () => useSelector(apiKeyAtom, (apiKey) => !!apiKey);
