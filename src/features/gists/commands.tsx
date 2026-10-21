import { usePreferences, useSession, useUpdatePreferences } from "@/features/account/queries";
import type { Command } from "@/features/commands/command";
import type { CommandPage } from "@/features/commands/palette";
import { useCommands } from "@/features/commands/registry";
import { openFile, useActiveFile } from "@/features/files/file";
import { timeAgo } from "@/shared/dates";
import {
  getFileDisplayName,
  getGistDisplayName,
  isArchived,
  TEMPLATE_FILENAME,
  type Gist,
} from "@/shared/github";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  Clock,
  Copy,
  Fullscreen,
  Link,
  Pin,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { deletesGist, useCreateAndOpenGist, useOpenTodaysNote } from "./actions";
import {
  useDuplicateGist,
  useGists,
  useIsStarred,
  useStarredGists,
  useToggleArchived,
  useToggleStarred,
} from "./queries";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { deleteGistDialog } from "./dialogs/DeleteGistDialog";

export function deleteCommand(gist: Gist | undefined, filename?: string): Command {
  return {
    id: `gist.delete:${gist?.id ?? ""}/${filename ?? ""}`,
    title: !gist || deletesGist(gist, filename) ? "Delete gist" : "Delete file",
    group: "This gist",
    icon: Trash2,
    disabled: !gist,
    agent:
      "Delete the gist (or just this file, when the gist has others), which asks the user to confirm.",
    run: () => gist && deleteGistDialog.openWithPayload({ gist, filename }),
  };
}

/** Commands are bound to a gist here, not reconstructed by menus and the palette. */
export function useGistCommands(gist: Gist | undefined) {
  const router = useRouter();
  const { user } = useSession();
  const { pinnedGists } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const isStarred = useIsStarred(gist?.id);
  const { mutateAsync: duplicate } = useDuplicateGist();
  const { mutate: archive } = useToggleArchived();
  const { mutate: star } = useToggleStarred();
  if (!gist) return null;

  const isOwn = gist.owner?.login === user?.login;
  const isPinned = pinnedGists.includes(gist.id);
  return {
    pin: {
      id: `gist.pin:${gist.id}`,
      group: "This gist",
      title: isPinned ? "Unpin gist" : "Pin gist",
      icon: Pin,
      checked: isPinned,
      agent: "Pin or unpin the gist (pinned gists are at the top of the gist list).",
      run: () =>
        updatePreferences(({ pinnedGists }) => ({
          pinnedGists: pinnedGists.includes(gist.id)
            ? pinnedGists.filter((id) => id !== gist.id)
            : [...pinnedGists, gist.id],
        })),
    } satisfies Command,
    star: {
      id: `gist.star:${gist.id}`,
      group: "This gist",
      title: isStarred ? "Unstar gist" : "Star gist",
      icon: Star,
      checked: isStarred,
      agent: "Star or unstar the gist on GitHub.",
      run: () => star(gist),
    } satisfies Command,
    duplicate: {
      id: `gist.duplicate:${gist.id}`,
      group: "This gist",
      title: "Duplicate gist",
      icon: Copy,
      disabled: !isOwn,
      agent: "Duplicate the gist (and open the copy).",
      run: async () => openFile((await duplicate(gist.id)).id),
    } satisfies Command,
    archive: {
      id: `gist.archive:${gist.id}`,
      group: "This gist",
      title: isArchived(gist) ? "Unarchive gist" : "Archive gist",
      icon: isArchived(gist) ? ArchiveRestore : Archive,
      checked: isArchived(gist),
      disabled: !isOwn,
      agent: "Archive or unarchive the gist (archived gists are hidden from the main gist list).",
      run: () => archive(gist),
    } satisfies Command,
    delete: { ...deleteCommand(gist), disabled: !isOwn },
    copyUrl: {
      id: `gist.copyUrl:${gist.id}`,
      group: "This gist",
      title: "Copy URL",
      icon: Link,
      run: async () => {
        await navigator.clipboard.writeText(`${location.origin}/#/${gist.id}`);
        toast.success("URL copied to clipboard!");
      },
    } satisfies Command,
    fullscreen: {
      id: `gist.fullscreen:${gist.id}`,
      group: "This gist",
      title: "View fullscreen",
      icon: Fullscreen,
      run: () =>
        router.navigate({ to: "/share/$gistId/{-$filePath}", params: { gistId: gist.id } }),
    } satisfies Command,
  };
}

const RECENT_COUNT = 6;

export function useOpenTodaysNoteCommand(): Command {
  const openTodaysNote = useOpenTodaysNote();
  return {
    id: "notes.today",
    group: "Gists",
    title: "Open today's note",
    icon: Calendar,
    agent: "Open today's daily note (creating it if it doesn't exist yet).",
    run: openTodaysNote,
  };
}

/** Registers executable gist operations and separately provides palette navigation. */
export function useGistListCommands(): CommandPage[] {
  const { gists, archivedGists, dailyNotes } = useGists();
  const starredGists = useStarredGists();
  const { pinnedGists, recentlyViewedGistFiles } = usePreferences();
  const { gistId: openGistId } = useActiveFile();
  const createGist = useCreateAndOpenGist();
  const todaysNote = useOpenTodaysNoteCommand();
  const recentIds = new Set(
    gists
      .filter((gist) => !pinnedGists.includes(gist.id) && gist.id !== openGistId)
      .slice(0, RECENT_COUNT)
      .map((gist) => gist.id),
  );

  const open = (
    gist: Gist,
    options: Partial<Pick<Command, "icon" | "detail" | "group" | "searchOnly">> = {},
  ): Command => ({
    id: `gist.open:${gist.id}`,
    title: getGistDisplayName(gist),
    group: "Gists",
    detail: timeAgo(gist.updated_at),
    run: () => openFile(gist.id),
    ...options,
  });
  const ownedIds = new Set([...gists, ...archivedGists].map((gist) => gist.id));
  const notes: Command[] = dailyNotes
    ? Object.keys(dailyNotes.files)
        .filter((name) => name !== TEMPLATE_FILENAME)
        .sort()
        .reverse()
        .map((filename) => ({
          id: `note.open:${dailyNotes.id}/${filename}`,
          title: getFileDisplayName(filename),
          group: "Daily notes",
          icon: Calendar,
          run: () => openFile(dailyNotes.id, filename),
        }))
    : [];

  useCommands([
    ...gists.map((gist) => {
      const pinned = pinnedGists.includes(gist.id);
      const recent = pinned || recentIds.has(gist.id);
      return open(gist, {
        group: recent ? "Recent" : "Gists",
        icon: pinned ? Pin : recent ? Clock : undefined,
        searchOnly: !recent,
      });
    }),
    ...starredGists
      .filter((gist) => !ownedIds.has(gist.id))
      .map((gist) => open(gist, { icon: Star, detail: gist.owner?.login, searchOnly: true })),
    ...archivedGists.map((gist) =>
      open(gist, { icon: Archive, detail: "Archived", searchOnly: true }),
    ),
    ...recentlyViewedGistFiles.map((recent): Command => ({
      id: `recent.open:${recent.id}/${recent.filename}`,
      group: "Recent",
      title: recent.description,
      icon: Clock,
      detail: recent.owner,
      run: () => openFile(recent.id, recent.filename),
    })),
    {
      id: "gist.new",
      group: "Gists",
      title: "New gist",
      icon: Plus,
      acceptsInput: true,
      run: (description) => createGist({ description }),
    },
    todaysNote,
    ...notes,
  ]);

  return dailyNotes
    ? [
        {
          id: `notes:${dailyNotes.id}`,
          group: "Gists",
          title: "Daily notes",
          icon: Calendar,
          commands: notes,
        },
      ]
    : [];
}
