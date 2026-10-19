import { applyDiff, applyPatchTool, type ApplyPatchResult, type Editor } from "@openai/agents";
import type { AgentDocument } from "./agent";

export const EDIT_TOOL = "apply_patch";

export const editInstructions = `# Editing the document
* Call the \`${EDIT_TOOL}\` tool with the path of the <current_document>. Don't respond with a plan, or an edited version of the document. Simply make the edits.
* Match the tone, style, and formatting conventions of the existing document, unless the user asks otherwise.
* Make all of the requested changes in a single patch when possible, and only change the lines that need to change (rather than deleting and re-adding unchanged lines).
* The document can't be renamed or deleted, and you can't create other files.`;

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
  const edit = (diff: string, mode?: "create") => {
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
        : (checkPath(path) ?? edit(diff)),
    deleteFile: async () => failed("The document can't be deleted."),
  };

  return applyPatchTool({ editor });
}
