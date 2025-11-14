export interface ToolDefinition {
    type?: "function";
    name: string;
    description: string;
    parameters?: {
        type: "object";
        properties: Record<string, any>;
        required: string[];
    };
}

export interface ToolResult {
    successMessage?: string;
    requestResponse?: boolean;
}

export interface Tool<T = any> {
    definition: ToolDefinition;
    handler: (args: T, context: VoiceToolHandlerContext) => Promise<ToolResult | void | string> | ToolResult | void | string;
    isEditTool?: boolean;
}

import { EditorMode } from "@/atoms";

export interface VoiceToolHandlerContext {
    gistId: string;
    content: string;
    editContent: (request: string) => Promise<string | undefined>;
    openFile: (filename: string) => void;
    addFile: (filename: string, content?: string) => Promise<void>;
    createGist: (description: string, content?: string) => void;
    reviewContent: (topic: string) => void;
    performResearch: (topic: string) => void;
    saveGist: () => Promise<void>;
    setEditorMode: (mode: EditorMode) => void;
    setCommentSidebarOpen: (open: boolean) => void;
    deleteGist: () => void;
    isMobile: boolean;
    audioStream: MediaStream | null;
    muteMic: () => void;
    endVoiceConversation: () => void;
}

