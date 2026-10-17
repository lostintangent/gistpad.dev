import * as github from "@/shared/github";
import { isArchived, isDailyNote, type Gist, type GistComment } from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import { useSession, useUpdatePreferences } from "@/features/session/queries";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

const MINUTE = 1000 * 60;

// Queries

export const gistQueries = {
  /** All of the user's markdown gists, most recently updated first. */
  list: () =>
    queryOptions({
      queryKey: ["gists", "list"],
      queryFn: github.listGists,
      staleTime: 5 * MINUTE,
    }),

  starred: () =>
    queryOptions({
      queryKey: ["gists", "starred"],
      queryFn: github.listStarredGists,
      staleTime: 5 * MINUTE,
    }),

  /** A gist, including the content of its files. */
  detail: (gistId: string) =>
    queryOptions({
      queryKey: ["gists", "detail", gistId],
      queryFn: () => github.getGist(gistId),
      staleTime: 2 * MINUTE,
    }),

  comments: (gistId: string) =>
    queryOptions({
      queryKey: ["gists", "comments", gistId],
      queryFn: () => github.listGistComments(gistId),
      staleTime: 2 * MINUTE,
    }),

  revisions: (gistId: string) =>
    queryOptions({
      queryKey: ["gists", "revisions", gistId],
      queryFn: () => github.listGistRevisions(gistId),
      staleTime: 5 * MINUTE,
    }),

  /** A gist, as it existed at a specific revision (which never changes). */
  revision: (gistId: string, revisionId: string) =>
    queryOptions({
      queryKey: ["gists", "revision", gistId, revisionId],
      queryFn: () => github.getGistRevision(gistId, revisionId),
      staleTime: "static",
    }),
};

interface GistLists {
  gists: Gist[];
  archivedGists: Gist[];
  dailyNotes: Gist | undefined;
}

const EMPTY_LISTS: GistLists = { gists: [], archivedGists: [], dailyNotes: undefined };

function partitionGists(gists: Gist[]): GistLists {
  return {
    gists: gists.filter((gist) => !isDailyNote(gist) && !isArchived(gist)),
    archivedGists: gists.filter((gist) => !isDailyNote(gist) && isArchived(gist)),
    dailyNotes: gists.find(isDailyNote),
  };
}

/** The signed-in user's gists, partitioned into their regular gists, archived gists and daily notes. */
export function useGists() {
  const { session } = useSession();
  const { data = EMPTY_LISTS, ...query } = useQuery({
    ...gistQueries.list(),
    enabled: !!session,
    select: partitionGists,
  });

  return { ...data, ...query };
}

export function useStarredGists() {
  const { session } = useSession();
  const { data = [] } = useQuery({ ...gistQueries.starred(), enabled: !!session });
  return data;
}

/** A gist and its file contents, which uses its list entry as a placeholder while loading. */
export function useGist(gistId: string | undefined) {
  return useQuery({
    ...gistQueries.detail(gistId ?? ""),
    enabled: !!gistId,
    placeholderData: () =>
      queryClient.getQueryData(gistQueries.list().queryKey)?.find((gist) => gist.id === gistId),
  });
}

/** Reads the content of a gist file, fetching the gist if it isn't already cached. */
export async function readGistFile(gistId: string, filename?: string) {
  const gist = await queryClient.query(gistQueries.detail(gistId));
  return gist.files[filename ?? github.getDefaultFile(gist)]?.content ?? "";
}

// Cache updates

/** Removes file contents and history, since list entries are only used for metadata (and are persisted). */
function toListEntry({ history: _, ...gist }: Gist): Gist {
  const files = Object.fromEntries(
    Object.entries(gist.files).map(([name, { content: _, ...file }]) => [name, file]),
  );

  return { ...gist, files };
}

function updateGistLists(update: (gists: Gist[]) => Gist[]) {
  queryClient.setQueryData(gistQueries.list().queryKey, (gists) => gists && update(gists));
  queryClient.setQueryData(gistQueries.starred().queryKey, (gists) => gists && update(gists));
}

/**
 * Updates the cache with a gist that the user just changed (or created), which moves it to the
 * top of their list (since it's now the most recently updated), and adds its latest revision.
 */
export function setGistData(gist: Gist) {
  queryClient.setQueryData(gistQueries.detail(gist.id).queryKey, gist);

  const entry = toListEntry(gist);
  queryClient.setQueryData(
    gistQueries.list().queryKey,
    (gists) => gists && [entry, ...gists.filter(({ id }) => id !== gist.id)],
  );
  queryClient.setQueryData(gistQueries.starred().queryKey, (gists) =>
    gists?.map((starred) => (starred.id === gist.id ? entry : starred)),
  );

  const [revision] = gist.history ?? [];
  if (revision) {
    queryClient.setQueryData(
      gistQueries.revisions(gist.id).queryKey,
      (revisions) =>
        revisions && [revision, ...revisions.filter(({ version }) => version !== revision.version)],
    );
  }
}

function removeGistData(gistId: string) {
  updateGistLists((gists) => gists.filter(({ id }) => id !== gistId));
  queryClient.removeQueries({ queryKey: gistQueries.detail(gistId).queryKey });
}

function updateCommentCount(gistId: string, delta: number) {
  const update = (gist: Gist) =>
    gist.id === gistId ? { ...gist, comments: Math.max(0, gist.comments + delta) } : gist;

  updateGistLists((gists) => gists.map(update));
  queryClient.setQueryData(gistQueries.detail(gistId).queryKey, (gist) => gist && update(gist));
}

// Gist mutations

export function useCreateGist() {
  return useMutation({
    mutationFn: github.createGist,
    onSuccess: setGistData,
    meta: { pendingMessage: "Creating gist...", errorMessage: "Failed to create gist" },
  });
}

export function useDeleteGist() {
  const updatePreferences = useUpdatePreferences();

  return useMutation({
    mutationFn: (gistId: string) => github.deleteGist(gistId),
    onSuccess: (_, gistId) => {
      removeGistData(gistId);
      updatePreferences(({ pinnedGists, recentlyViewedGistFiles, gistTags }) => {
        const { [gistId]: _, ...remainingGistTags } = gistTags;
        return {
          pinnedGists: pinnedGists.filter((id) => id !== gistId),
          recentlyViewedGistFiles: recentlyViewedGistFiles.filter(({ id }) => id !== gistId),
          gistTags: remainingGistTags,
        };
      });
    },
    meta: { errorMessage: "Failed to delete gist" },
  });
}

export function useDeleteGistFile() {
  return useMutation({
    mutationFn: ({ gistId, filename }: { gistId: string; filename: string }) =>
      github.deleteGistFile(gistId, filename),
    onSuccess: setGistData,
    meta: { errorMessage: "Failed to delete file" },
  });
}

export function useAddGistFile() {
  return useMutation({
    mutationFn: ({
      gistId,
      filename,
      content,
    }: {
      gistId: string;
      filename: string;
      content?: string;
    }) => github.addGistFile(gistId, filename, content),
    onSuccess: setGistData,
    meta: { errorMessage: "Failed to add file" },
  });
}

export function useRenameGistFile() {
  return useMutation({
    mutationFn: ({
      gistId,
      filename,
      newFilename,
    }: {
      gistId: string;
      filename: string;
      newFilename: string;
    }) => github.renameGistFile(gistId, filename, newFilename),
    onSuccess: setGistData,
    meta: { errorMessage: "Failed to rename file" },
  });
}

export function useUpdateGistDescription() {
  return useMutation({
    mutationFn: ({ gist, description }: { gist: Gist; description: string }) =>
      github.updateGistDescription(gist, description),
    onSuccess: setGistData,
    meta: { errorMessage: "Failed to update description" },
  });
}

export function useToggleArchived() {
  return useMutation({
    mutationFn: (gist: Gist) =>
      isArchived(gist) ? github.unarchiveGist(gist) : github.archiveGist(gist),
    onSuccess: setGistData,
    meta: { errorMessage: "Failed to archive gist" },
  });
}

export function useDuplicateGist() {
  return useMutation({
    mutationFn: github.duplicateGist,
    onSuccess: setGistData,
    meta: { pendingMessage: "Duplicating gist...", errorMessage: "Failed to duplicate gist" },
  });
}

export function useForkGist() {
  return useMutation({
    mutationFn: github.forkGist,
    onSuccess: setGistData,
    meta: { pendingMessage: "Forking gist...", errorMessage: "Failed to fork gist" },
  });
}

export function useToggleStarred() {
  const updatePreferences = useUpdatePreferences();

  return useMutation({
    mutationFn: async ({ gist, isStarred }: { gist: Gist; isStarred: boolean }) => {
      await (isStarred ? github.unstarGist(gist.id) : github.starGist(gist.id));
    },
    onSuccess: (_, { gist, isStarred }) => {
      queryClient.setQueryData(gistQueries.starred().queryKey, (gists = []) =>
        isStarred ? gists.filter(({ id }) => id !== gist.id) : [toListEntry(gist), ...gists],
      );

      // Starred gists are listed separately, so they don't need to be "recently viewed" as well.
      if (!isStarred) {
        updatePreferences(({ recentlyViewedGistFiles }) => ({
          recentlyViewedGistFiles: recentlyViewedGistFiles.filter(({ id }) => id !== gist.id),
        }));
      }
    },
    meta: { errorMessage: "Failed to update starred gists" },
  });
}

/** Saves a gist file (and any files embedded in it). */
export function useSaveGistFiles() {
  return useMutation({
    mutationKey: ["saveGistFiles"],
    mutationFn: ({
      gistId,
      files,
    }: {
      gistId: string;
      files: { filename: string; content: string }[];
    }) => github.saveGistFiles(gistId, files),
    onSuccess: setGistData,
    meta: { errorMessage: "Failed to save gist" },
  });
}

/**
 * Returns the daily notes gist, after making sure it contains today's note (which is
 * created from the user's template, if needed).
 */
export async function openDailyNote() {
  const dailyNotes = (await queryClient.query(gistQueries.list())).find(isDailyNote);
  if (dailyNotes?.files[github.getTodayNoteFilename()]) return dailyNotes;

  // The template's content is needed, which isn't included in the gist list.
  const template = dailyNotes && (await queryClient.query(gistQueries.detail(dailyNotes.id)));
  const gist = await github.createDailyNote(template);

  setGistData(gist);
  return gist;
}

export function useOpenDailyNote() {
  return useMutation({
    mutationFn: openDailyNote,
    // Opening the daily note can create it, so concurrent opens (e.g. double-clicks) run in sequence
    scope: { id: "daily-note" },
    meta: { errorMessage: "Failed to open daily note" },
  });
}

// Comment mutations

function updateComments(gistId: string, update: (comments: GistComment[]) => GistComment[]) {
  queryClient.setQueryData(
    gistQueries.comments(gistId).queryKey,
    (comments) => comments && update(comments),
  );
}

export function useCreateComment(gistId: string) {
  return useMutation({
    mutationFn: (body: string) => github.createGistComment(gistId, body),
    onSuccess: (comment) => {
      updateComments(gistId, (comments) => [...comments, comment]);
      updateCommentCount(gistId, 1);
    },
    meta: { errorMessage: "Failed to add comment" },
  });
}

export function useUpdateComment(gistId: string) {
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string }) =>
      github.updateGistComment(gistId, commentId, body),
    onSuccess: (comment) =>
      updateComments(gistId, (comments) =>
        comments.map((c) => (c.id === comment.id ? comment : c)),
      ),
    meta: { errorMessage: "Failed to update comment" },
  });
}

export function useDeleteComment(gistId: string) {
  return useMutation({
    mutationFn: (commentId: number) => github.deleteGistComment(gistId, commentId),
    onSuccess: (_, commentId) => {
      updateComments(gistId, (comments) => comments.filter(({ id }) => id !== commentId));
      updateCommentCount(gistId, -1);
    },
    meta: { errorMessage: "Failed to delete comment" },
  });
}
