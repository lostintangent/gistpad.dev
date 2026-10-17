import { useIsMobile } from "@/shared/useMediaQuery";
import { getDefaultFile, type Gist } from "@/shared/github";
import { useForkGist, useGist, useSaveGistFiles } from "@/features/gists/queries";
import { useSession } from "@/features/session/queries";
import { discardDraft, draftAtom, focusRequestAtom, useDraft } from "./store";
import { commentsPanelOpenAtom } from "@/features/comments/store";
import { mobileSidebarOpenAtom } from "./store";
import { useNavigate, useParams } from "@tanstack/react-router";
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
  const draft = useDraft(doc.documentKey);
  return draft?.content ?? doc.savedContent;
}

/** Reads the content of the open document (e.g. in an event handler), including any unsaved changes. */
export function readDocumentContent(doc: GistDocument) {
  const draft = draftAtom.get();
  return draft?.documentKey === doc.documentKey ? draft.content : doc.savedContent;
}

/** On mobile, documents take up the whole screen, so close the panels that would cover them. */
export function prepareToOpenDocument(isMobile: boolean) {
  if (isMobile) {
    mobileSidebarOpenAtom.set(false);
    commentsPanelOpenAtom.set(false);
  }
}

/**
 * Opens a gist (or one of its files), while preserving the current view mode. And when
 * `focus` is set (e.g. for a new file), the editor is focused, so the user can start typing.
 */
export function useOpenDocument() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (gistId?: string, filename?: string, { focus = false } = {}) => {
    prepareToOpenDocument(isMobile);

    if (gistId && focus) {
      focusRequestAtom.set({ gistId, filename });
    }

    return navigate({
      to: "/{-$gistId}/{-$filePath}",
      params: { gistId, filePath: filename },
      // The editor isn't visible in preview mode, so switch to edit mode in order to focus it.
      search: ({ view }) => ({ view: focus && view === "preview" ? undefined : view }),
    });
  };
}

function getDraftFiles(doc: GistDocument) {
  const draft = draftAtom.get();
  if (!draft || draft.documentKey !== doc.documentKey) return null;

  return {
    draft,
    files: [
      { filename: doc.filename, content: draft.content },
      ...Object.entries(draft.embeddedFiles).map(([filename, read]) => ({
        filename,
        content: read(),
      })),
    ],
  };
}

/** Saves the open document's unsaved changes (including any embedded files). */
export function useSaveDocument(doc: GistDocument) {
  const { mutateAsync: saveFiles } = useSaveGistFiles();

  return async () => {
    const changes = getDraftFiles(doc);
    if (!doc.gistId || !changes) return;

    await saveFiles({ gistId: doc.gistId, files: changes.files });

    // Clear the draft, unless it was edited further while saving
    draftAtom.set((draft) => (draft === changes.draft ? null : draft));
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

/** Forks the open document (which belongs to someone else), and saves its changes to the fork. */
export function useForkAndSave(doc: GistDocument) {
  const { mutateAsync: forkGist } = useForkGist();
  const { mutateAsync: saveFiles } = useSaveGistFiles();
  const openDocument = useOpenDocument();

  return async () => {
    const changes = getDraftFiles(doc);
    if (!doc.gistId || !changes) return;

    const fork = await forkGist(doc.gistId);
    await saveFiles({ gistId: fork.id, files: changes.files });

    discardDraft();
    await openDocument(fork.id, doc.filename);
  };
}

/** Saves the open document, or if it belongs to someone else, forks it and saves to the fork. */
export function useSaveOrFork(doc: GistDocument) {
  const save = useSaveDocument(doc);
  const forkAndSave = useForkAndSave(doc);
  return () => (doc.isReadOnly ? forkAndSave() : save());
}
