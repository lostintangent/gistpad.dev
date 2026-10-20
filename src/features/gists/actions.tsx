import { useIsMobile } from "@/shared/useMediaQuery";
import { getTodayNoteFilename, TEMPLATE_FILENAME, type Gist } from "@/shared/github";
import {
  ensureTodaysNote,
  getMostRecentGist,
  useAddFile,
  useCreateGist,
  useDeleteGist,
  useDeleteFile,
} from "./queries";
import { useUpdatePreferences } from "@/features/account/queries";
import { closeMobilePanels, mobilePanelAtom } from "@/features/workbench/layout/state";
import { draftAtom } from "@/features/files/draft";
import { useActiveFile, openFile } from "@/features/files/file";
import { useMutation } from "@tanstack/react-query";

/** Creates a gist (optionally tagged), and then opens it. */
export function useCreateAndOpenGist() {
  const { mutateAsync: createGist } = useCreateGist();
  const updatePreferences = useUpdatePreferences();

  return async ({
    tagIds = [],
    ...options
  }: Parameters<typeof createGist>[0] & { tagIds?: string[] }) => {
    const gist = await createGist(options);

    if (tagIds.length > 0) {
      updatePreferences(({ gistTags }) => ({ gistTags: { ...gistTags, [gist.id]: tagIds } }));
    }

    await openFile(gist.id, undefined, { focus: true });
  };
}

/** Adds a file to a gist, and then opens it. */
export function useAddAndOpenFile() {
  const { mutateAsync: addFile } = useAddFile();

  return async (gistId: string, filename: string, content?: string) => {
    await addFile({ gistId, filename, content });
    await openFile(gistId, filename, { focus: true });
  };
}

/** Opens today's daily note (creating it if needed). */
export function useOpenTodaysNote() {
  const { mutateAsync: ensureNote } = useMutation({
    mutationFn: ensureTodaysNote,
    // Today's note might need to be created, so concurrent opens (e.g. double-clicks) run in sequence
    scope: { id: "daily-note" },
    meta: { errorMessage: "Failed to open daily note" },
  });

  return async () => {
    const dailyNotes = await ensureNote();
    // (Even if it's already open, e.g. to return to it from the mobile gist list)
    closeMobilePanels();
    await openFile(dailyNotes.id, getTodayNoteFilename(), { focus: true });
  };
}

/** Opens the template that daily notes are created from (creating it if needed). */
export function useOpenDailyTemplate() {
  const addAndOpenFile = useAddAndOpenFile();

  return (dailyNotes: Gist) => {
    if (!dailyNotes.files[TEMPLATE_FILENAME]) {
      return addAndOpenFile(dailyNotes.id, TEMPLATE_FILENAME, "# 📆 {{date}}\n\n");
    }

    // (Even if it's already open, e.g. to return to it from the mobile gist list)
    closeMobilePanels();
    return openFile(dailyNotes.id, TEMPLATE_FILENAME);
  };
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
  const { mutateAsync: deleteFile } = useDeleteFile();
  const activeFile = useActiveFile();
  const isMobile = useIsMobile();

  return async (gist: Gist, filename?: string) => {
    const isDeletingGist = deletesGist(gist, filename);
    if (isDeletingGist) await deleteGist(gist.id);
    else await deleteFile({ gistId: gist.id, filename: filename! });

    const wasOpen =
      gist.id === activeFile.gistId && (isDeletingGist || filename === activeFile.filename);
    if (!wasOpen) return;

    // The deleted changes don't need to be saved.
    draftAtom.set(null);

    if (!isDeletingGist) {
      await openFile(gist.id);
    } else {
      await openFile((await getMostRecentGist())?.id);
      if (isMobile) mobilePanelAtom.set("sidebar");
    }
  };
}
