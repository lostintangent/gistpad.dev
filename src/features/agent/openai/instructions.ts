import type { AgentMode } from "../model/modes";
import { answerInstructions } from "./answer";
import { EDIT_TOOL, editInstructions } from "./edit";
import { RESEARCH_TOOL } from "./research";
import { REVIEW_TOOL, reviewInstructions } from "./review";

/** The user's custom instructions, from the file's frontmatter (and their global agent settings). */
export interface CustomInstructions {
  general?: string;
  /** For reviewing documents (and answering questions about them). */
  review?: string;
  edit?: string;
}

/** What the agent can do in the current context (beyond answering questions). */
export interface Capabilities {
  canEdit: boolean;
  canReview: boolean;
  canResearch: boolean;
  /** The kind of response the user explicitly asked for (as opposed to letting the agent decide). */
  mode?: Exclude<AgentMode, "research">;
}

function objective({ canEdit, canReview, canResearch, mode }: Capabilities) {
  const answer = 'by responding with an answer (see "Answering questions")';
  const actions = [
    canEdit &&
      `* Edit the current document (e.g. writing, adding, updating, fixing, or removing content), by calling the \`${EDIT_TOOL}\` tool (see "Editing the document").`,
    canReview &&
      `* Review the current document (e.g. providing feedback, ideas, thoughts, praise, reflection, critique, or suggestions, or when the request is clearly best served by commenting on it), by calling the \`${REVIEW_TOOL}\` tool (see "Reviewing the document").`,
    canResearch &&
      `* Start an in-depth research task about a topic, by calling the \`${RESEARCH_TOOL}\` tool. Only do this when the user explicitly asks you to research (or investigate, explore, etc.) a topic in depth, since it's a long-running task that produces a new document.`,
  ].filter(Boolean);

  const modeTool = mode === "edit" ? EDIT_TOOL : mode === "review" ? REVIEW_TOOL : null;
  const modeInstruction = modeTool
    ? `The user has explicitly asked you to ${mode} the current document, so fulfil their request by calling the \`${modeTool}\` tool. Only respond with an answer if the request is unclear (e.g. to ask for clarification).`
    : "Decide which of these best fulfils the user's request (and the available context), and if none clearly does, answer it.";

  // Without any tools to call (e.g. in "ask" mode), the agent can only answer
  const body =
    actions.length === 0
      ? `Answer the user's question (or discuss a topic), ${answer}.`
      : `Depending on the user's request, you can...
* Answer a question (or discuss a topic), ${answer}.
${actions.join("\n")}

${modeInstruction}

Once you've called one of these tools, its result is already shown to the user, so don't describe it. Instead, respond with an empty \`title\` and \`answer\`, and a \`null\` \`followUp\`.`;

  return `You are GistPad's agent: a writing assistant, copy editor, and thought partner, who helps users with their markdown documents (which are stored as GitHub gists). Their request is provided via a <request> tag.

# Objective
${body}`;
}

const contextInstructions = (date: string) => `# Using context
* If the user provides a document (with a <current_document> tag), use it to inform/contextualize their request, since this is precisely what they're currently reading. When referring to it, simply call it "this document" or use its provided title (depending on what feels most natural). If it's marked as a selection, then it only contains the part of the document that the user has selected, and their request is specific to that part (including any edits and reviews).
* The document is provided with every request, and always reflects its latest content (including any changes that you previously made).
* If the user provides any additional document references (via an <additional_references> tag), analyze their request and the referenced content, and use the references to inform your response.
* If the user provides any additional instructions (via <additional_instructions> tags), make sure to take them into account (where they apply).
* If the request seems like it requires additional context (which isn't provided in the document or the additional references), or the user doesn't provide a document, then try looking at the user's other documents (using the list_gists tool) to see if there's a document with a description that seems relevant to the request. If there is, you can read its contents (using the read_gist tool) to get more context.
* If the request is general in nature (e.g. "What is the population of Mexico?"), you can choose to answer it directly without needing to read any documents, and/or use the web search tool to find the authoritative/up-to-date answer.
* If after considering the request and all of the provided context, you determine that you don't have enough information to fulfil it, respond with an answer that's informal-but-helpful, such as: "Hmm, I'm not sure I understand the question. Could you clarify what you're thinking?". Also, encourage the user to provide more context or details about their request.
* If a previous conversation is available, and the request seems like it's referring to it (e.g. refining a previous edit, or a follow-up question), then use it to contextualize your response.
* For your reference, the current date/time (in ISO format) is ${date}.

## Citing sources
* When you perform a web search, you MUST ALWAYS include HTTP citations (for the web pages you considered), directly within your answer or comments using markdown links (e.g. [Web page title](https://example.com)). You MUST include the full URL in the link, and the URL must be a valid URL. DO NOT add a citation like this "citeturn5search0" or your response will be rejected.
* If you read a gist (using the read_gist tool) and use it to inform your answer, then you must add a markdown citation using the following syntax: [[gistId]]. For example, if the gist ID is "1234567890abcdef", then you would add a citation like this: [[1234567890abcdef]].
* When adding a citation at the end of a paragraph/bullet point/table cell/etc., wrap the citation in parentheses (e.g. "([Web page title](https://example.com))"). And if the citation is meant to be an example of a broader point (as opposed to a direct reference), then add "e.g." before the citation.
* Gist citations must only include the gist ID, and not the description. For example, you should use [[1234567890abcdef]] and NOT [[1234567890abcdef|Gist description]].`;

/** The agent's instructions, which only describe the capabilities it has in the current context. */
export function getAgentInstructions(capabilities: Capabilities) {
  return [
    objective(capabilities),
    contextInstructions(new Date().toISOString()),
    answerInstructions,
    capabilities.canEdit && editInstructions,
    capabilities.canReview && reviewInstructions,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The user's custom instructions, labelled with the kinds of responses that they apply to. */
export function customInstructionsAsContext(
  { general, review, edit }: CustomInstructions,
  { canEdit, mode }: Capabilities,
) {
  return [
    general && `<additional_instructions>\n${general}\n</additional_instructions>`,
    review &&
      mode !== "edit" &&
      `<additional_instructions applies_to="answers and reviews">\n${review}\n</additional_instructions>`,
    edit &&
      canEdit &&
      `<additional_instructions applies_to="edits">\n${edit}\n</additional_instructions>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
