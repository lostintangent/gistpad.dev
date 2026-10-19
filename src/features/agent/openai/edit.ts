import { applyPatchTool, type ApplyPatchResult, type Editor } from "@openai/agents";
import type { AgentDocument } from "./agent";
import { applyDiff } from "./applyDiff";

export const EDIT_TOOL = "apply_patch";

export const editInstructions = `# Editing the document
When the user asks you to change the current document, edit it by calling the \`${EDIT_TOOL}\` tool (with the path of the <current_document>).
* Analyze the request and the document (and any other context), and think about the best way to accomplish the request. Don't respond with a plan, or an edited version of the document. Simply make the edits.
* Match the tone, style, and formatting conventions of the existing document, unless the user asks otherwise.
* Make all of the requested changes in a single patch when possible, and only change the lines that need to change. Lines that aren't changing should only be included as (unmodified) context, and never deleted and re-added.
* Include enough context (usually 3 lines) around each change to uniquely identify it. When that isn't enough, use \`@@\` with the markdown heading that the change belongs to (and chain them to jump between nested headings). Always include entire lines (including their leading whitespace and formatting) as context.
* If the document is empty, then simply add its new content.
* The document can't be renamed or deleted, and you can't create other files.
* If a patch fails to apply, then read its error, and try again with a corrected patch.
* Once you've finished editing, the user will review your changes (in a diff), so don't describe them. Respond with an empty \`title\` and \`answer\`, and a \`null\` \`followUp\`.`;

const normalizePath = (path: string) => path.replace(/^\.?\//, "");

/**
 * The tool that the agent edits the current document with (which is the only file that it can
 * edit), by applying patches to it. Failures are reported back to the agent, so that it can correct
 * them and try again.
 */
export function editTool(document: AgentDocument, onEdit: (content: string) => Promise<void>) {
  let content = document.content;
  let pendingEdit: Promise<unknown> = Promise.resolve();

  const failed = (output: string): ApplyPatchResult => ({ status: "failed", output });
  const checkPath = (path: string) =>
    normalizePath(path) === normalizePath(document.path)
      ? null
      : failed(`You can only edit the current document (${document.path}).`);

  // Edits are applied one at a time, since each one is relative to the previous one.
  const edit = (diff: string, mode: "create" | "update") => {
    const result = pendingEdit.then(async (): Promise<ApplyPatchResult> => {
      let edited: string;
      try {
        edited = applyDiff(content, diff, mode);
      } catch (error) {
        return failed(`The patch couldn't be applied, so please fix it and try again: ${error}`);
      }

      if (edited === content) return { output: "The patch didn't change the document." };

      await onEdit(edited);
      content = edited;
      return { output: `Edited ${document.path}.` };
    });

    pendingEdit = result.catch(() => {});
    return result;
  };

  const editor: Editor = {
    // Since the document already exists, "creating" it replaces its content
    createFile: async ({ path, diff }) => checkPath(path) ?? edit(diff, "create"),
    updateFile: async ({ path, diff, moveTo }) =>
      moveTo && normalizePath(moveTo) !== normalizePath(path)
        ? failed("The document can't be renamed.")
        : (checkPath(path) ?? edit(diff, "update")),
    deleteFile: async () => failed("The document can't be deleted."),
  };

  return applyPatchTool({ editor });
}
