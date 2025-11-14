import { Tool } from "../types";
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

const tools = [
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

export function getToolHandlers() {
    const handlers: Record<string, Tool["handler"]> = {};
    tools.forEach((tool) => {
        handlers[tool.definition.name] = tool.handler;
    });
    return handlers;
}

export function getBaseTools() {
    return tools
        .filter((tool) => !tool.isEditTool)
        .map((tool) => ({
            ...tool.definition,
            type: "function",
        }));
}

export function getEditTools() {
    return tools
        .filter((tool) => tool.isEditTool)
        .map((tool) => ({
            ...tool.definition,
            type: "function",
        }));
}
