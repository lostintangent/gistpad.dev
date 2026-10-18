import { MOBILE_MEDIA_QUERY } from "@/shared/useMediaQuery";
import { getDefaultFile, type Gist } from "@/shared/github";
import { useForkGist, useGist, useSaveGistFiles } from "@/features/gists/queries";
import { useSession } from "@/features/account/queries";
import { draftAtom, focusRequestAtom, readDraft, setEmbeddedFile, useDraft } from "./store";
import { commentsPanelOpenAtom } from "@/features/comments/store";
import { mobilePanelAtom } from "./layout";
import type { Whiteboard } from "@/features/markdown/TLDraw";
import { router } from "@/router";
import { useParams } from "@tanstack/react-router";
import { useIsMutating } from "@tanstack/react-query";

function resolveFilename(gist: Gist | undefined, filePath: string | undefined) {
  if (!gist) return filePath ?? "README.md";
  return filePath && gist.files[filePath] ? filePath : getDefaultFile(gist);
}

/** The open document (i.e. gist file), which is determined by the current URL. */
export function useDocument() {
  const { gistId, filePath } = useParams({ strict: false });
  const { user } = useSession();
  const { data: gist, isPlaceholderData, error } = useGist(gistId);

  const filename = resolveFilename(gist, filePath);
  const isLoaded = !!gist && !isPlaceholderData;

  return {
    gistId,
    gist,
    filename,
    /** Whether the document is the gist's README (whose title is the gist's description). */
    isReadme: filename === "README.md",
    documentKey: gistId ? `${gistId}/${filename}` : "",
    /** The document's content, as it was last saved. */
    savedContent: (isLoaded && gist.files[filename]?.content) || "",
    isLoading: !!gistId && !isLoaded && !error,
    error,
    /** Whether the document belongs to someone else (and therefore, needs to be forked to save). */
    isReadOnly: !user || gist?.owner?.login !== user.login,
  };
}

export type GistDocument = ReturnType<typeof useDocument>;

/** The content of the open document, including any unsaved changes. */
export function useDocumentContent(doc: GistDocument) {
  return useDraft(doc)?.content ?? doc.savedContent;
}

/** Reads the content of the open document (e.g. in an event handler), including any unsaved changes. */
export function readDocumentContent(doc: GistDocument) {
  return readDraft(doc)?.content ?? doc.savedContent;
}

/** The document's whiteboard (i.e. its ```tldraw block), which is saved as a sidecar file. */
export function getWhiteboard(doc: GistDocument): Whiteboard | undefined {
  if (!doc.gist) return;

  const filename = `${doc.filename}.tldraw`;
  return {
    key: doc.documentKey,
    snapshot: doc.gist.files[filename]?.content,
    onChange: (serialize) => setEmbeddedFile(doc, filename, serialize),
  };
}

/** On mobile, documents take up the whole screen, so close the panels that push them aside. */
export function prepareToOpenDocument() {
  if (window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
    mobilePanelAtom.set(null);
    commentsPanelOpenAtom.set(false);
  }
}

/**
 * Opens a gist (or one of its files), while preserving the current mode. And when
 * `focus` is set (e.g. for a new file), the editor is focused, so the user can start typing.
 */
export function openDocument(gistId?: string, filename?: string, { focus = false } = {}) {
  prepareToOpenDocument();

  if (gistId && focus) focusRequestAtom.set({ gistId, filename });

  return router.navigate({
    to: "/{-$gistId}/{-$filePath}",
    params: { gistId, filePath: filename },
    // The editor isn't visible in preview mode, so switch to edit mode in order to focus it.
    search: ({ view }) => ({ view: focus && view === "preview" ? undefined : view }),
  });
}

/**
 * Saves the open document's changes (including its embedded files). Other people's gists can't
 * be saved, so they're forked first, and then the fork is opened.
 */
export function useSaveDocument(doc: GistDocument) {
  const { mutateAsync: forkGist } = useForkGist();
  const { mutateAsync: saveFiles } = useSaveGistFiles();

  return async () => {
    const draft = readDraft(doc);
    if (!doc.gistId || !draft) return;

    const gistId = doc.isReadOnly ? (await forkGist(doc.gistId)).id : doc.gistId;
    await saveFiles({
      gistId,
      files: [
        { filename: doc.filename, content: draft.content },
        ...Object.entries(draft.embeddedFiles).map(([filename, read]) => ({
          filename,
          content: read(),
        })),
      ],
    });

    // Clear the draft, unless it was edited further while saving
    draftAtom.set((current) => (current === draft ? null : current));
    if (gistId !== doc.gistId) await openDocument(gistId, doc.filename);
  };
}

/** Whether the open document is being saved (which can be triggered from several places, e.g. shortcuts). */
export function useIsSaving(doc: GistDocument) {
  const savingCount = useIsMutating({
    mutationKey: ["saveGistFiles"],
    predicate: ({ state }) => (state.variables as { gistId?: string })?.gistId === doc.gistId,
  });
  return savingCount > 0;
}
