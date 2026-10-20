import {
  applyDiff,
  applyPatchTool,
  tool,
  type ApplyPatchResult,
  type Editor,
} from "@openai/agents";
import type { AgentDocument } from "../model/context";
import type { AgentTool } from "../model/tools";

// Adapts the agent's tools to the Agents SDK.

/** Adapts an agent tool, whose failures are reported to the agent (unless they fail the request). */
export const toSdkTool = ({ failsRequest, ...agentTool }: AgentTool) =>
  tool({ ...agentTool, errorFunction: failsRequest ? null : undefined });

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
