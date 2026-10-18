import { useIsMobile } from "@/shared/useMediaQuery";
import { getTodayNoteFilename, TEMPLATE_FILENAME, type Gist } from "@/shared/github";
import {
  getMostRecentGist,
  useAddGistFile,
  useCreateGist,
  useDeleteGist,
  useDeleteGistFile,
  useOpenDailyNote,
} from "./queries";
import { useUpdatePreferences } from "@/features/account/queries";
import { draftAtom, mobilePanelAtom } from "@/features/editor/store";
import { useDocument, useOpenDocument } from "@/features/editor/document";

/** Creates a gist (optionally tagged), and then opens it. */
export function useCreateAndOpenGist() {
  const { mutateAsync: createGist } = useCreateGist();
  const updatePreferences = useUpdatePreferences();
  const openDocument = useOpenDocument();

  return async ({
    tagIds = [],
    ...options
  }: Parameters<typeof createGist>[0] & { tagIds?: string[] }) => {
    const gist = await createGist(options);

    if (tagIds.length > 0) {
      updatePreferences(({ gistTags }) => ({ gistTags: { ...gistTags, [gist.id]: tagIds } }));
    }

    await openDocument(gist.id, undefined, { focus: true });
  };
}

/** Adds a file to a gist, and then opens it. */
export function useAddAndOpenFile() {
  const { mutateAsync: addFile } = useAddGistFile();
  const openDocument = useOpenDocument();

  return async (gistId: string, filename: string, content?: string) => {
    await addFile({ gistId, filename, content });
    await openDocument(gistId, filename, { focus: true });
  };
}

/** Opens today's daily note (creating it if needed). */
export function useOpenTodaysNote() {
  const { mutateAsync: openDailyNote } = useOpenDailyNote();
  const openDocument = useOpenDocument();

  return async () => {
    const dailyNotes = await openDailyNote();
    await openDocument(dailyNotes.id, getTodayNoteFilename(), { focus: true });
  };
}

/** Opens the template that daily notes are created from (creating it if needed). */
export function useOpenDailyTemplate() {
  const addAndOpenFile = useAddAndOpenFile();
  const openDocument = useOpenDocument();

  return (dailyNotes: Gist) =>
    dailyNotes.files[TEMPLATE_FILENAME]
      ? openDocument(dailyNotes.id, TEMPLATE_FILENAME)
      : addAndOpenFile(dailyNotes.id, TEMPLATE_FILENAME, "# 📆 {{date}}\n\n");
}

/** Whether deleting a gist's file deletes the gist itself (i.e. its README, or its only file). */
export const deletesGist = (gist: Gist, filename?: string) =>
  !filename || filename === "README.md" || Object.keys(gist.files).length === 1;

/**
 * Deletes a gist, or one of its files. And if it's currently open, then (like when the app opens)
 * the most recent gist is opened instead, beside the gist list on mobile.
 */
export function useDeleteGistOrFile() {
  const { mutateAsync: deleteGist } = useDeleteGist();
  const { mutateAsync: deleteGistFile } = useDeleteGistFile();
  const openDoc = useDocument();
  const openDocument = useOpenDocument();
  const isMobile = useIsMobile();

  return async (gist: Gist, filename?: string) => {
    const isDeletingGist = deletesGist(gist, filename);
    if (isDeletingGist) await deleteGist(gist.id);
    else await deleteGistFile({ gistId: gist.id, filename: filename! });

    const wasOpen = gist.id === openDoc.gistId && (isDeletingGist || filename === openDoc.filename);
    if (!wasOpen) return;

    // The deleted changes don't need to be saved.
    draftAtom.set(null);

    if (!isDeletingGist) {
      await openDocument(gist.id);
    } else {
      await openDocument((await getMostRecentGist())?.id);
      if (isMobile) mobilePanelAtom.set("sidebar");
    }
  };
}
