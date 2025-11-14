import askContent from "@/agents/qa/ask";
import { AiLoadingMessage } from "@/components/AiLoadingMessage";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { WidgetDefinition, WidgetProps } from "../types";

async function fetchData(config?: Record<string, string>): Promise<string> {
  const prompt = config?.prompt;
  if (!prompt) {
    return "";
  }
  let response = "";
  await askContent(
    undefined,
    prompt,
    undefined,
    undefined,
    undefined,
    (delta) => {
      response = delta;
    }
  );
  return response;
}

function AIWidget({ data, isLoading }: WidgetProps<string>) {
  if (isLoading) {
    return <AiLoadingMessage />;
  }

  if (!data) {
    return null;
  }

  return <MarkdownPreview isReadonly={true}>{data}</MarkdownPreview>;
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
} as WidgetDefinition<string>;

