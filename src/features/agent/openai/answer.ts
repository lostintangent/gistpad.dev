import diagramPlaceholderUrl from "@/assets/diagram-placeholder.svg";
import type { ParsedElementInfo } from "@streamparser/json";
import { z } from "zod";

export const followUpSchema = z.object({ question: z.string(), topic: z.string() });

/** A follow-up request that the agent suggests (after an answer or review), which the user can run. */
export type AgentFollowUp = z.infer<typeof followUpSchema>;

/** The structured output that the agent responds with (which is empty after an edit or review). */
export const answerSchema = z.object({
  title: z.string(),
  answer: z.string(),
  followUp: followUpSchema.nullable(),
});

export interface Answer {
  /** The answer's (markdown) text, including its title. */
  text: string;
  followUp: AgentFollowUp | null;
}

export const answerInstructions = `# Answering questions
* Provide a concise heading for the answer in the \`title\` property, prefixed with a fun emoji. Do not include this heading inside the answer text itself.
* As needed, make use of markdown formatting, such as bold, italics, underline (<ins></ins>), lists, and tables, to enhance readability and structure.
* Favor lists over tables, unless the content is tabular in nature. For unordered lists, always use the \`-\` prefix. And for ordered lists, always use the \`1.\` prefix.
* Favor concise and direct answers, and avoid unnecessary verbosity/formatting. But if a question truly requires a detailed answer, and that answer includes logical sub-sections, then make use of level-4 markdown headings to organize things clearly (e.g. \`#### Sub-section\`).
* CRITICAL: Don't use "•" to indicate list items or delineate different text values. Use proper lists (e.g. \`-\` or \`1.\`) and/or leverage italic/bold/underline/etc. to seperate labels/values (e.g. "- *Why this fits:* Because this is..."). Sub lists can be used by simply indenting the list item with 4 spaces (e.g. "    - *Sub-item*").
* Since the \`followUp\` property will include a follow-up question/topic, you don't need to include a follow-up question/statement at the end of the answer text itself (e.g. "Let me know if..").
* When a diagram or chart is helpful, you can generate a Mermaid diagram by starting a code block with \`\`\`mermaid and ending it with \`\`\`. Use this whenever it enhances or is requested in an answer.
   - If a graph node's label needs to include parentheses, make sure to wrap the entire label in double quotes (e.g. \`M --> N["TLS Shutdown (if any)"]\`). If you don't do this, the diagram will fail to render.

## Suggesting a follow-up question
* In order to keep the conversation flowing, suggest a follow-up question/topic that the user might want to ask next, based on the current request and your response.
* The follow-up question will be shown to the user as a button that they'll be able to click, in order to accept the follow-up suggestion. Therefore...
   - Your follow-up question should be relevant to the entire discussion, and feel logically connected to the current request and response.
   - The follow-up question should be a topic that the user might want to ask about next (in response to your answer), and should feel like an expansion or continuation of the current request/response.
   - The follow-up question must be something that could be "answered" by the user simply clicking a button to submit it, and doesn't require ANY additional input from the user.
   - Don't ask vague questions that would require the user to provide additional input. For example, the following are bad examples of follow-up questions you MUST NEVER use:
        * "Do you want to know more about the topic?" (it refers to "the topic" as opposed to referring directly to the topic by name)
        * "Would you like a detailed summary of one of these suggestions?" or "Would you like a breakdown for any of the suggestions?" (these aren't simple yes/no questions, since they require the user to provide additional input about WHICH suggestion they want a follow-up on. The question should either be inclusive of all suggestions, or refer to a specific suggestion by name)
* If the user has provided any additional references or instructions, make sure to incorporate that into your follow-up question.
* The follow-up question/topic won't be rendered as markdown, so just use plain text (e.g. don't use bold, italics, etc.).
* The follow-up can only be a subsequent question to ask, as opposed to an action to take (e.g. editing a document, or creating a new gist).`;

/** Removes the citation markers that web searches can leave in the agent's text. */
export const removeCitationMarkers = (text: string) =>
  text.replace(/citeturn\d+(search|view)\d+/g, "");

const MERMAID_PLACEHOLDER = `![Mermaid diagram in progress](${diagramPlaceholderUrl})`;

// Streaming responses can contain an unfinished mermaid diagram at the end
// of the output. Since only one unfinished diagram can exist at a time,
// simply swap it with a placeholder until the closing \````\` arrives.
function replaceIncompleteMermaid(text: string) {
  const openIndex = text.lastIndexOf("```mermaid");
  const isIncomplete = openIndex !== -1 && !text.includes("```", openIndex + "```mermaid".length);
  return isIncomplete ? text.slice(0, openIndex) + MERMAID_PLACEHOLDER : text;
}

/** Parses a (streaming) answer, and reports it once it has some text. */
export function createAnswerParser(onAnswer: (answer: Answer) => void) {
  let title = "";
  let answer = "";
  let followUp: AgentFollowUp | null = null;

  return ({ key, value, stack }: ParsedElementInfo) => {
    if (stack.length === 1 && key === "title") {
      title = String(value ?? "");
    } else if (stack.length === 1 && key === "answer") {
      answer = replaceIncompleteMermaid(removeCitationMarkers(String(value ?? "")));
    } else if (stack.length === 2 && stack[1].key === "followUp") {
      if (key !== "question" && key !== "topic") return;
      followUp = { question: "", topic: "", ...followUp, [key]: String(value ?? "") };
    } else {
      return;
    }

    // After editing (or reviewing), the agent responds with an empty answer
    if (title || answer) {
      onAnswer({ text: [title && `## ${title}`, answer].filter(Boolean).join("\n\n"), followUp });
    }
  };
}
