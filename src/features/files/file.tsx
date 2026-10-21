import { getDefaultFile, type Gist } from "@/shared/github";
import { useForkGist, useGist, useSaveFiles } from "@/features/gists/queries";
import { useSession } from "@/features/account/queries";
import { draftAtom, readDraft, setEmbeddedFile, useDraft } from "./draft";
import { createAtom } from "@tanstack/react-store";
import type { Whiteboard } from "@/features/markdown/TLDraw";
import { getRouterInstance } from "@tanstack/react-start";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { useIsMutating } from "@tanstack/react-query";

function resolveFilename(gist: Gist | undefined, filePath: string | undefined) {
  if (!gist) return filePath ?? "README.md";
  return filePath && gist.files[filePath] ? filePath : getDefaultFile(gist);
}

/** The active file, which is determined by the current URL. */
export function useActiveFile() {
  const isShell = useRouter().isShell();
  const isRouting = useRouterState({ select: (state) => state.status === "pending" });
  const params = useParams({ strict: false, shouldThrow: false });
  const { gistId, filePath } = params ?? {};
  const { user } = useSession();
  const { data: gist, isPlaceholderData, error } = useGist(gistId);

  const filename = resolveFilename(gist, filePath);
  const isLoaded = !!gist && !isPlaceholderData;

  return {
    gistId,
    gist,
    filename,
    /** Whether the file is the gist's README (whose title is the gist's description). */
    isReadme: filename === "README.md",
    key: gistId ? `${gistId}/${filename}` : "",
    /** The file's content, as it was last saved. */
    savedContent: (isLoaded && gist.files[filename]?.content) || "",
    isLoading: isShell || !params || ((!!gistId || isRouting) && !isLoaded && !error),
    error,
    /** Whether the file belongs to someone else (and therefore, needs to be forked to save). */
    isReadOnly: !user || gist?.owner?.login !== user.login,
  };
}

export type ActiveFile = ReturnType<typeof useActiveFile>;

/** The content of the active file, including any unsaved changes. */
export function useFileContent(file: ActiveFile) {
  return useDraft(file)?.content ?? file.savedContent;
}

/** Reads the content of the active file (e.g. in an event handler), including any unsaved changes. */
export function readFileContent(file: ActiveFile) {
  return readDraft(file)?.content ?? file.savedContent;
}

/** The file's whiteboard (i.e. its ```tldraw block), which is saved as a sidecar file. */
export function getWhiteboard(file: ActiveFile): Whiteboard | undefined {
  if (!file.gist) return;

  const filename = `${file.filename}.tldraw`;
  return {
    key: file.key,
    snapshot: file.gist.files[filename]?.content,
    onChange: (serialize) => setEmbeddedFile(file, filename, serialize),
  };
}

/** A gist (or one of its files) whose editor should be focused, with the cursor at the end, once it opens. */
export const focusRequestAtom = createAtom<{ gistId: string; filename?: string } | null>(null);

/**
 * Opens a gist (or one of its files), while preserving the current mode. And when
 * `focus` is set (e.g. for a new file), the editor is focused, so the user can start typing.
 */
export async function openFile(gistId?: string, filename?: string, { focus = false } = {}) {
  if (gistId && focus) focusRequestAtom.set({ gistId, filename });

  const router = await getRouterInstance();
  return router.navigate({
    to: "/{-$gistId}/{-$filePath}",
    params: { gistId, filePath: filename },
    // The editor isn't visible in preview mode, so switch to edit mode in order to focus it.
    search: ({ view }) => ({ view: focus && view === "preview" ? undefined : view }),
  });
}

/**
 * Saves the active file's changes (including its embedded files). Other people's gists can't
 * be saved, so they're forked first, and then the fork is opened.
 */
export function useSaveFile(file: ActiveFile) {
  const { mutateAsync: forkGist } = useForkGist();
  const { mutateAsync: saveFiles } = useSaveFiles();

  return async () => {
    const draft = readDraft(file);
    if (!file.gistId || !draft) return;

    const gistId = file.isReadOnly ? (await forkGist(file.gistId)).id : file.gistId;
    await saveFiles({
      gistId,
      files: [
        { filename: file.filename, content: draft.content },
        ...Object.entries(draft.embeddedFiles).map(([filename, read]) => ({
          filename,
          content: read(),
        })),
      ],
    });

    // Clear the draft, unless it was edited further while saving
    draftAtom.set((current) => (current === draft ? null : current));
    if (gistId !== file.gistId) await openFile(gistId, file.filename);
  };
}

/** Whether the active file is being saved (which can be triggered from several places, e.g. shortcuts). */
export function useIsSaving(file: ActiveFile) {
  const savingCount = useIsMutating({
    mutationKey: ["saveFiles"],
    predicate: ({ state }) => (state.variables as { gistId?: string })?.gistId === file.gistId,
  });
  return savingCount > 0;
}
