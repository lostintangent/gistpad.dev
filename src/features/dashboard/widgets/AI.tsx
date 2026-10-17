import { AiLoadingMessage } from "@/features/ai/AiLoadingMessage";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { WidgetDefinition, WidgetProps } from "../types";

async function fetchData(config?: Record<string, string>): Promise<string> {
  const prompt = config?.prompt;
  if (!prompt) {
    return "";
  }
  const { askContent } = await import("@/features/ai/agents");
  let answer = "";
  await askContent({ prompt, onAnswer: (text) => (answer = text) });
  return answer;
}

function AIWidget({ data, isLoading }: WidgetProps<string>) {
  if (isLoading) {
    return <AiLoadingMessage />;
  }

  if (!data) {
    return null;
  }

  return <MarkdownPreview isReadOnly>{data}</MarkdownPreview>;
}

export default {
  name: "AI",
  config: [
    { id: "name", name: "Name" },
    { id: "prompt", name: "Prompt" },
  ],
  fetchData,
  component: AIWidget,
  staleTime: 1000 * 60 * 60 * 24,
} satisfies WidgetDefinition<string>;
