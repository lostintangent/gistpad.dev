import type { Tool } from "../types";
import addGistFileTool from "./add-gist-file";
import changeViewModeTool from "./change-view-mode";
import createGistTool from "./create-gist";
import deleteGistTool from "./delete-gist";
import editGistTool from "./edit-gist";
import endConversationTool from "./end-conversation";
import generateImageTool from "./generate-image";
import muteMicrophoneTool from "./mute-microphone";
import openGistFileTool from "./open-gist-file";
import openUrlTool from "./open-url";
import saveGistTool from "./save-gist";
import performResearchTool from "./perform-research";
import reviewContentTool from "./review-content";
import toggleCommentSidebarTool from "./toggle-comment-sidebar";

const tools: Tool[] = [
  endConversationTool,
  muteMicrophoneTool,
  openGistFileTool,
  openUrlTool,
  createGistTool,
  changeViewModeTool,
  editGistTool,
  generateImageTool,
  addGistFileTool,
  deleteGistTool,
  reviewContentTool,
  performResearchTool,
  saveGistTool,
  toggleCommentSidebarTool,
];

export const getToolHandler = (name: string) =>
  tools.find(({ definition }) => definition.name === name)?.handler;

/** The tools that the voice assistant can call (which only includes edit tools, if the user can edit). */
export const getToolDefinitions = ({ canEdit }: { canEdit: boolean }) =>
  tools
    .filter((tool) => canEdit || !tool.isEditTool)
    .map((tool) => ({ ...tool.definition, type: "function" }));
