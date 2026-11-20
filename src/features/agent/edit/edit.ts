// The agent edits the current document (or selection) by writing patches for it. Its tool is OpenAI's
// native `apply_patch` tool (which the model is trained to call), so only its name and instructions
// are defined here, and the OpenAI runtime binds it to the document (see `openai/tools.ts`).

export const EDIT_TOOL = "apply_patch";

/** When the agent can choose to edit the document (which it decides between its other modes). */
export const editAction = `* Edit the current document (e.g. writing, adding, updating, fixing, or removing content), by calling the \`${EDIT_TOOL}\` tool (see "Editing the document").`;

export const editInstructions = `# Editing the document
* Call the \`${EDIT_TOOL}\` tool with the path of the <current_document>. Don't respond with a plan, or an edited version of the document. Simply make the edits.
* If the requested result is already satisfied, leave the document unchanged and briefly say no edit is needed. Don't call a tool just to make a change.
* If multiple targets match and the request, selection, or conversation doesn't resolve which one is intended, ask for clarification without editing. Change all matches when the user explicitly requests all of them.
* Match the tone, style, and formatting conventions of the existing document, unless the user asks otherwise.
* Preserve existing list markers and whitespace unless changing them is required by the request. Numbering that is already correct needs no normalization.
* A Markdown section includes its heading and all content up to the next heading of the same or higher level. When moving a section after another, insert it after that entire section, keeping all other content in its original section and order.
* Make all of the requested changes in a single patch when possible, and only change the lines that need to change (rather than deleting and re-adding unchanged lines).
* Copy patch context from exact, complete, contiguous lines in the supplied document. Don't start context partway through a line or treat separated paragraphs as adjacent.
* The document can't be renamed or deleted, and you can't create other files.`;
