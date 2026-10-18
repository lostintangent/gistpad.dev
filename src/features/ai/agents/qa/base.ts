import {
  Agent,
  AgentOutputType,
  run as runAgent,
  setDefaultOpenAIClient,
  webSearchTool,
} from "@openai/agents";
import { JSONParser, type ParsedElementInfo } from "@streamparser/json";
import {
  createOpenAIClient,
  getModelProperties,
  referencesAsContext,
  userCommentsAsContext,
  type AgentFollowUp,
  type AgentRequest,
} from "../openai";
import { gistTools } from "../tools";

const baseSystemPrompt = `## Using context
* If the user provides a document(with a < current_document > tag), you should use that document to inform / contextualize the question, since this is precisely what they're currently reading, and therefore, is likely directly relevant to the question. And if you need to refer to the document in your answer, simply refer to it as "this document" or use it's provided title(depending on what feels most natural).
* If the user provides any additional document references(via a < additional_references > tag), make sure to analyze the question and the referenced content, and use the provided references to inform your answer.
* If the user provides any additional instructions(via a < additional_instructions > tag), make sure to take those into account when answering the question.
* If the question seems like it requires additional context(which isn't provided in the document or the additional references), or the user doesn't provide a document(via the < current_document > tag), then try looking at the user's other documents (using the list_gists tool) to see if there's a document with a description that seems relevant to the question.If there is, you can read the contents of the document(using the read_gist tool) to get more context.
* If the question is general in nature(e.g. "What is the population of Mexico?"), you can choose to answer it directly without needing to read any documents and / or use the web search tool to find the authoritative / up - to - date answer.
* If after considering the question and all of the provided context, you determine that you don't have enough information to answer the question, you should respond with something informal-but-helpful such as: "Hmm, I'm not sure I understand the question.Could you clarify what you're thinking?". Also, encourage the user to provide more context or details about their question.
* For your reference, the following is the current date/time in ISO format: ${new Date().toISOString()}

### Citing sources
* When you perform a web search, you MUST ALWAYS include HTTP citations (for the web pages you considered), directly within the answer itself using markdown links (e.g. [Web page title](https://example.com)). You MUST include the full URL in the link, and the URL must be a valid URL. DO NOT add a citation like this "citeturn5search0" or your answer will be rejected.
* If you read a gist (using the read_gist tool) and use it to inform your answer, then you must add a markdown citation using the following syntax: [[gistId]]. For example, if the gist ID is "1234567890abcdef", then you would add a citation like this: [[1234567890abcdef]].
* When adding a citation at the end of a paragraph/bullet point/table cell/etc., wrap the citation in parentheses (e.g. "([Web page title](https://example.com))"). And if the citation is meant to be an example of a broader point (as opposed to a direct reference), then add "e.g." before the citation.
* Gist citations must only include the gist ID, and not the description. For example, you should use [[1234567890abcdef]] and NOT [[1234567890abcdef|Gist description]]. The description is only used for the user-facing citation, which will be rendered in markdown.

## Suggesting a follow-up question
* In order to keep the conversation flowing, you should suggest a follow-up question/topic that the user might want to ask next, based on the current request/question and response/answer.
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

/** The progress that the Q&A agents (ask and review) report, while they stream their response. */
export interface QaProgress {
  followUp: AgentFollowUp | null;
  reasoningSummary: string | null;
  isWebSearching: boolean;
}

/** The options that the Q&A agents have in common, where `onUpdate` is called as their result streams in. */
export interface QaAgentOptions<Result extends QaProgress> extends AgentRequest {
  onUpdate: (changes: Partial<Result>) => void;
}

interface StreamingAgentOptions extends QaAgentOptions<QaProgress> {
  mode: "ask" | "review";
  systemPrompt: string;
  outputSchema: AgentOutputType;
  onParserValue: (info: ParsedElementInfo) => void;
}

export async function runStreamingAgent(options: StreamingAgentOptions) {
  setDefaultOpenAIClient(createOpenAIClient());

  const modelProperties = getModelProperties(options.mode);
  const agent = new Agent({
    name: options.mode,
    instructions: `${options.systemPrompt}\n\n${baseSystemPrompt}`,
    model: modelProperties.model,
    modelSettings: { providerData: modelProperties },
    outputType: options.outputSchema,
    tools: [webSearchTool(), ...gistTools],
  });

  const { prompt, content, description, instructions, userComments, references } = options;
  const input = [
    `<request>${prompt}</request>`,
    content?.trim() &&
      `<current_document${description ? ` title="${description}"` : ""}>\n${content}\n</current_document>`,
    userCommentsAsContext(userComments),
    referencesAsContext(references),
    instructions && `<additional_instructions>${instructions}</additional_instructions>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = await runAgent(agent, input, {
    previousResponseId: options.previousResponseId,
    stream: true,
    signal: options.signal,
  });

  const parser = new JSONParser({ emitPartialTokens: true, emitPartialValues: true });
  const followUp: AgentFollowUp = { question: "", topic: "" };
  parser.onValue = (info) => {
    options.onParserValue(info);

    const { key, value, stack } = info;
    if (stack[1]?.key === "follow_up") {
      if (key === "question" || key === "topic") followUp[key] = String(value ?? "");
      options.onUpdate({ followUp: { ...followUp } });
    }
  };

  let reasoningSummary = "";
  for await (const event of stream) {
    if (options.signal?.aborted) return null;
    if (event.type !== "raw_model_stream_event") continue;

    const { data } = event;
    if (data.type === "output_text_delta") {
      parser.write(data.delta);
    } else if (data.type === "model") {
      const { type, delta } = data.event;
      if (type === "response.reasoning_summary_part.added") {
        reasoningSummary = "";
      } else if (type === "response.reasoning_summary_text.delta") {
        reasoningSummary += delta;
        options.onUpdate({ reasoningSummary });
      } else if (type === "response.web_search_call.in_progress") {
        options.onUpdate({ isWebSearching: true });
      } else if (type === "response.web_search_call.completed") {
        options.onUpdate({ isWebSearching: false });
      }
    }
  }

  return stream.lastResponseId ?? null;
}
