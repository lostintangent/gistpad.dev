// The agent edits the current document (or selection) by writing patches for it. Its tool is OpenAI's
// native `apply_patch` tool (which the model is trained to call), so only its name and instructions
// are defined here, and the OpenAI runtime binds it to the document (see `openai/tools.ts`).

export const EDIT_TOOL = "apply_patch";

/** When the agent can choose to edit the document (which it decides between its other modes). */
export const editAction = `* Edit the current document (e.g. writing, adding, updating, fixing, or removing content), by calling the \`${EDIT_TOOL}\` tool (see "Editing the document").`;

export const editInstructions = `# Editing the document
* Call the \`${EDIT_TOOL}\` tool with the path of the <current_document>. Don't respond with a plan, or an edited version of the document. Simply make the edits.
* Match the tone, style, and formatting conventions of the existing document, unless the user asks otherwise.
* Make all of the requested changes in a single patch when possible, and only change the lines that need to change (rather than deleting and re-adding unchanged lines).
* The document can't be renamed or deleted, and you can't create other files.`;
