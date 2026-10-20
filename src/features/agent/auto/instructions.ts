import { EDIT_TOOL, editAction } from "../edit/edit";
import type { Capabilities } from "../model/modes";
import { researchAction } from "../research/research";
import { REVIEW_TOOL, reviewAction } from "../review/review";

// In "auto" mode, the agent decides how to respond: it can always answer, and it's told which of its other
// modes it can respond with (and when to choose them). When the user explicitly chooses a mode instead,
// it's told to respond with that one.

/** Describes the responses that the agent can choose between, and how to choose. */
export function routingInstructions({ canEdit, canReview, canResearch, mode }: Capabilities) {
  const answer = 'by responding with an answer (see "Answering questions")';
  const actions = [
    canEdit && editAction,
    canReview && reviewAction,
    canResearch && researchAction,
  ].filter(Boolean);

  const modeTool = mode === "edit" ? EDIT_TOOL : mode === "review" ? REVIEW_TOOL : null;
  const modeInstruction = modeTool
    ? `The user has explicitly asked you to ${mode} the current document, so fulfil their request by calling the \`${modeTool}\` tool. Only respond with an answer if the request is unclear (e.g. to ask for clarification).`
    : "Decide which of these best fulfils the user's request (and the available context), and if none clearly does, answer it.";

  // Without any tools to call (e.g. in "ask" mode), the agent can only answer
  return actions.length === 0
    ? `Answer the user's question (or discuss a topic), ${answer}.`
    : `Depending on the user's request, you can...
* Answer a question (or discuss a topic), ${answer}.
${actions.join("\n")}

${modeInstruction}

Once you've called one of these tools, its result is already shown to the user, so don't describe it. Instead, respond with an empty \`title\` and \`answer\`, and a \`null\` \`followUp\`.`;
}
