import type { Gist, GistFile } from "@/lib/github";
import { atom } from "jotai";

// Note: These should only be directly settable by the
// index page, since we need to detect unsaved changes
// before allowing a gist or file selection change to happen.
export const selectedGistAtom = atom<Gist | null>();
export const selectedGistFileAtom = atom<string>("README.md");

export const hasUnsavedChangesAtom = atom(false);
export const isAiCommandInProgressAtom = atom(false);
export const embededdedFileHandlersAtom = atom<(() => GistFile)[]>([]);

export const selectedGistFilesAtom = atom((get) => {
    const gist = get(selectedGistAtom);
    return gist?.files ? Object.keys(gist.files) : [];
});

export type EditorMode = "edit" | "preview" | "split";
export const editorModeAtom = atom<EditorMode>("edit");

export const selectedHeadingAtom = atom<string | null>(null);
