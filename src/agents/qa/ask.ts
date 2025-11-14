import { Tool } from "@openai/agents";
import { z } from "zod";
import { AgentFollowUp, type AdditionalReference } from "../openai";
import { runStreamingAgent } from "./base";

const MERMAID_PLACEHOLDER =
  "![Mermaid diagram in progress](/diagram-placeholder.svg)";

// Streaming responses can contain an unfinished mermaid diagram at the end
// of the output. Since only one unfinished diagram can exist at a time,
// simply swap it with a placeholder until the closing \````\` arrives.
function replaceIncompleteMermaid(text: string): string {
  if (!text) return text;

  const openIndex = text.lastIndexOf("```mermaid");
  if (openIndex === -1) {
    return text;
  }

  const closeIndex = text.indexOf("```", openIndex + "```mermaid".length);
  if (closeIndex === -1) {
    return text.slice(0, openIndex) + MERMAID_PLACEHOLDER;
  }

  return text;
}

const systemPrompt = `# Objective
* Your objective is to answer a user's question (provided with a <request> tag), and then suggest a compelling follow-up question.
* You should first analyze the question and determine the best way to answer it, based on the nature of the question and the available context (see below for instructions on how to do this).

## Answering the question
* Provide a concise heading for the answer in the \`title\` property, prefixed with a fun emoji. Do not include this heading inside the answer text itself.
* As needed, make use of markdown formatting, such as bold, italics, underline (<ins></ins>), lists, and tables, to enhance readability and structure.
* Favor lists over tables, unless the content is tabular in nature. For unordered lists, always use the \`-\` prefix. And for ordered lists, always use the \`1.\` prefix.
* Favor concise and direct answers, and avoid unnecessary verbosity/formatting. But if a question truly requires a detailed answer, and that answer includes logical sub-sections, then make use of level-4 markdown headings to organize things clearly (e.g. \`#### Sub-section\`).
* CRITICAL: Don't use "•" to indicate list items or delineate different text values. Use proper lists (e.g. \`*\` or \`1.\`) and/or leverage italic/bold/underline/etc. to seperate labels/values (e.g. "- *Why this fits:* Because this is..."). Sub lists can be used by simply indenting the list item with 4 spaces (e.g. "    - *Sub-item*").
* Since the \`follow_up\` property will include a follow-up question/topic, you don't need to include a follow-up question/statement at the end of the answer text itself (e.g. "Let me know if..").
* When a diagram or chart is helpful, you can generate a Mermaid diagram by starting a code block with \`\`\`mermaid and ending it with \`\`\`. Use this whenever it enhances or is requested in an answer.
   - If a graph node's label needs to include parentheses, make sure to wrap the entire label in double quotes (e.g. \`M --> N["TLS Shutdown (if any)"]\`). If you don't do this, the diagram will fail to render.
`;

export default async function askContent(
  content: string | undefined,
  question: string,
  description?: string,
  instructions?: string,
  additionalReferences?: AdditionalReference[],
  onDelta?: (delta: string) => void,
  onFollowUp?: (followUp: AgentFollowUp) => void,
  onReasoning?: (summary: string) => void,
  onIsWebSearching?: (isSearching: boolean) => void,
  previousResponseId?: string,
  abortSignal?: AbortSignal,
  extraTools?: Tool[]
): Promise<string | null> {
  let title = "";
  return runStreamingAgent({
    agentType: "ask",
    systemPrompt,
    outputSchema: z.object({
      title: z.string(),
      answer: z.string(),
      follow_up: z.object({
        question: z.string(),
        topic: z.string(),
      }),
    }),
    prompt: question,
    context: {
      content,
      description,
      instructions,
      additionalReferences,
    },
    onParserValue: ({ key, value }) => {
      if (key === "title") {
        title = `## ${value}`;
        onDelta?.(title);
      } else if (key === "answer") {
        const answer = (value as string)?.replace(
          /citeturn\d+(search|view)\d+/g,
          ""
        );
        const processed = replaceIncompleteMermaid(answer);
        onDelta?.(`${title}\n\n${processed}`);
      }
    },
    onFollowUp,
    extraTools,
    onReasoning,
    onIsWebSearching,
    previousResponseId,
    abortSignal,
  });
}
