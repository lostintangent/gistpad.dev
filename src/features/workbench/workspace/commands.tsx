import { usePreferences, useUpdatePreferences } from "@/features/account/queries";
import { useAgentReview } from "@/features/agent/model/store";
import type { Command } from "@/features/commands/command";
import type { CommandPage } from "@/features/commands/palette";
import { useCommands } from "@/features/commands/registry";
import { closeComments, commentsPanelOpenAtom, openComments } from "@/features/comments/store";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { useDraft } from "@/features/files/draft";
import { openFile, readFileContent, useIsSaving, type ActiveFile } from "@/features/files/file";
import { deleteCommand, useGistCommands } from "@/features/gists/commands";
import { manageTagsCommand, tagCommands } from "@/features/gists/tagCommands";
import { gistQueries } from "@/features/gists/queries";
import { useRouter } from "@tanstack/react-router";
import { getFileDisplayName, getMarkdownFiles, isDailyNote } from "@/shared/github";
import { timeAgo } from "@/shared/dates";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSelector } from "@tanstack/react-store";
import { useQuery } from "@tanstack/react-query";
import {
  Columns2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Fullscreen,
  History,
  Link,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useEditorMode, type EditorMode } from "../layout/mode";
import { zenModeAtom } from "../layout/state";
import { revisionAtom, toContentRevisions, useIsViewingRevision } from "./history/revision";

/** The active workspace's controller. Commands and toolbar state outlive the toolbar's chrome. */
export function useWorkspaceCommands(file: ActiveFile, save: () => unknown) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [mode, setMode] = useEditorMode();
  const isZenMode = useSelector(zenModeAtom);
  const isCommentsOpen = useSelector(commentsPanelOpenAtom);
  const isViewingRevision = useIsViewingRevision();
  const hasChanges = !!useDraft(file);
  const isSaving = useIsSaving(file);
  const { comments, isEnabled: isCommentsEnabled } = useCommentThreads(file);
  const review = useAgentReview(file.key);
  const { tags, gistTags } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const gist = useGistCommands(file.gist);
  const revisionId = useSelector(revisionAtom);
  // (What the toolbar is editing, which is reset for the next file)
  const [editing, setEditing] = useState<{ fileKey: string; what: "title" | "file" } | null>(null);
  const [historyRequested, setHistoryRequested] = useState<string | null>(null);

  const isDisabled = file.isLoading || !!file.error;
  const canEditFiles =
    !isDisabled && !file.isReadOnly && !isViewingRevision && !!file.gist && !isDailyNote(file.gist);
  const canViewHistory = !file.isReadOnly && !!file.gist && !isDailyNote(file.gist);
  const history = useQuery({
    ...gistQueries.revisions(file.gistId),
    select: toContentRevisions,
    enabled: canViewHistory && historyRequested === file.key,
  });
  const revisions = history.data ?? [];
  const viewCommand = (
    value: EditorMode,
    title: string,
    icon: Command["icon"],
    agent: string,
  ): Command => ({
    id: `view.${value}`,
    title,
    group: "View",
    icon,
    checked: mode === value,
    disabled: isDisabled || (isMobile && value === "split"),
    agent,
    run: () => setMode(value),
  });

  const view = {
    edit: viewCommand("edit", "Edit mode", Pencil, "Show the document's editor only."),
    split: viewCommand(
      "split",
      "Split mode",
      Columns2,
      "Show the editor and the rendered document side by side.",
    ),
    preview: viewCommand("preview", "Preview mode", Eye, "Show the rendered document only."),
  };
  const zen: Command = {
    id: "view.zen",
    title: isZenMode ? "Exit zen mode" : "Enter zen mode",
    group: "View",
    icon: isZenMode ? EyeOff : Eye,
    checked: isZenMode,
    disabled: isDisabled || isMobile,
    agent: "Enter or leave zen mode (which hides everything but the document).",
    run: () => {
      zenModeAtom.set(!isZenMode);
      if (!isZenMode) setMode("split");
    },
  };
  const share = {
    copyUrl: {
      id: `file.copyUrl:${file.key}`,
      group: "This gist",
      title: "Copy URL",
      icon: Link,
      disabled: isDisabled || isViewingRevision,
      agent: "Copy the document's URL to the clipboard.",
      run: async () => {
        await navigator.clipboard.writeText(location.href);
        toast.success("URL copied to clipboard!");
      },
    } satisfies Command,
    copyHtml: {
      id: `file.copyHtml:${file.key}`,
      group: "This gist",
      title: "Copy as HTML",
      icon: FileText,
      disabled: isDisabled || isViewingRevision,
      agent: "Copy the document to the clipboard as HTML.",
      run: async () => {
        const { copyAsHtml } = await import("@/features/markdown/toHtml");
        await copyAsHtml(readFileContent(file));
        toast.success("HTML copied to clipboard!");
      },
    } satisfies Command,
    zen,
    fullscreen: {
      id: `file.fullscreen:${file.key}`,
      group: "This gist",
      title: "View fullscreen",
      icon: Fullscreen,
      disabled: isDisabled || isViewingRevision,
      agent: "Show the rendered document fullscreen (its share page).",
      run: () =>
        router.navigate({
          to: "/share/$gistId/{-$filePath}",
          params: { gistId: file.gistId!, filePath: file.filename },
        }),
    } satisfies Command,
    github: {
      id: `file.github:${file.key}`,
      group: "This gist",
      title: "Open in GitHub",
      icon: ExternalLink,
      disabled: isDisabled || isViewingRevision,
      agent: "Open the gist on GitHub, in a new tab.",
      run: () => {
        const anchor = file.isReadme ? "" : `#file-${file.filename.replace(/\./g, "-")}`;
        window.open(`https://gist.github.com/${file.gistId}${anchor}`, "_blank");
      },
    } satisfies Command,
  };

  const commands = {
    mode,
    view,
    share,
    gist,
    isDisabled,
    isViewingRevision,
    hasChanges,
    canViewHistory,
    canEditFiles,
    isCommentsOpen,
    isCommentsEnabled,
    commentCount: comments.length + (review?.comments.length ?? 0),
    isEditingTitle: editing?.fileKey === file.key && editing.what === "title",
    isAddingFile: editing?.fileKey === file.key && editing.what === "file",
    stopEditing: () => setEditing(null),
    save: {
      id: "file.save",
      group: "This gist",
      title: file.gist && file.isReadOnly ? "Fork and save" : "Save",
      icon: Save,
      shortcut: "Mod+S",
      disabled: isDisabled || isViewingRevision || !hasChanges || isSaving,
      agent:
        "Save the document's pending changes to the gist. Only when the user asks to save: edits are shown without saving. Someone else's gist is forked first, which asks the user.",
      run: save,
    } satisfies Command,
    addFile: {
      id: "file.add",
      group: "This gist",
      title: "Add new file",
      icon: Plus,
      disabled: !canEditFiles,
      run: () => setEditing({ fileKey: file.key, what: "file" }),
    } satisfies Command,
    editTitle: {
      id: "file.rename",
      group: "This gist",
      title: file.isReadme ? "Edit description" : "Rename file",
      icon: Pencil,
      disabled: !canEditFiles || isZenMode,
      run: () => setEditing({ fileKey: file.key, what: "title" }),
    } satisfies Command,
    comments: {
      id: "view.comments",
      group: "View",
      title: isCommentsOpen ? "Hide comments" : "Show comments",
      icon: MessageSquare,
      checked: isCommentsOpen,
      disabled: isDisabled || isViewingRevision || !isCommentsEnabled,
      agent: "Show or hide the comments sidebar.",
      run: isCommentsOpen ? closeComments : () => openComments(),
    } satisfies Command,
    delete:
      file.isLoading || (file.gist && !file.isReadOnly)
        ? { ...deleteCommand(file.gist, file.filename), disabled: isDisabled || isViewingRevision }
        : null,
    tags: [
      ...tagCommands(tags, gistTags[file.gistId ?? ""] ?? [], (ids) => {
        if (!file.gistId) throw new Error("No gist is open.");
        const gistId = file.gistId;
        updatePreferences(({ gistTags }) => ({ gistTags: { ...gistTags, [gistId]: ids } }));
      }),
      manageTagsCommand,
    ],
  };

  const pages: CommandPage[] = [];
  if (file.gist) {
    pages.push({
      id: `tags:${file.gist.id}`,
      title: "Tags",
      group: "This gist",
      icon: Tag,
      commands: commands.tags,
    });
    if (canViewHistory) {
      pages.push({
        id: `history:${file.key}`,
        title: "History",
        group: "This gist",
        icon: History,
        commands: [
          {
            id: "revision.current",
            title: "Current version",
            checked: revisionId === null,
            run: () => revisionAtom.set(null),
          },
          ...revisions.map((revision) => ({
            id: `revision:${revision.version}`,
            title: timeAgo(revision.committed_at),
            detail: `+${revision.change_status.additions} −${revision.change_status.deletions}`,
            checked: revisionId === revision.version,
            run: () => revisionAtom.set(revision.version),
          })),
        ],
        // (The revisions are fetched once the page is opened, and refreshed when it's reopened)
        load: () => {
          setHistoryRequested(file.key);
          if (history.isStale) void history.refetch();
        },
        isLoading: history.isPending,
      });
    }
  }
  useCommands(
    file.gist && gist
      ? [
          ...getMarkdownFiles(file.gist)
            .filter((filename) => filename !== file.filename)
            .map((filename): Command => ({
              id: `file.open:${file.gistId}/${filename}`,
              title: getFileDisplayName(filename),
              group: "Files",
              icon: FileText,
              agent: `Open the gist's "${getFileDisplayName(filename)}" file.`,
              run: () => openFile(file.gistId, filename),
            })),
          ...Object.values(view).filter((command) => !command.disabled),
          ...(isCommentsEnabled ? [commands.comments] : []),
          ...(!zen.disabled ? [zen] : []),
          commands.save,
          ...(canEditFiles ? [commands.addFile, commands.editTitle] : []),
          gist.pin,
          gist.star,
          ...(!file.isReadOnly ? [gist.duplicate, gist.archive] : []),
          share.copyUrl,
          share.copyHtml,
          share.fullscreen,
          share.github,
          ...(commands.delete ? [commands.delete] : []),
          ...pages.flatMap((page) => page.commands),
        ]
      : [],
  );
  return { ...commands, pages };
}

export type WorkspaceCommands = ReturnType<typeof useWorkspaceCommands>;
