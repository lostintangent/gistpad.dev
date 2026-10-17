import { useAiReview, useIsAiInProgress } from "@/features/ai/store";
import { closeComments, commentsPanelOpenAtom, openComments } from "@/features/comments/store";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { deletesGist, useAddAndOpenFile } from "@/features/gists/actions";
import { deleteGistDialog } from "@/features/gists/dialogs/DeleteGistDialog";
import {
  useRenameGistFile,
  useStarredGists,
  useToggleStarred,
  useUpdateGistDescription,
} from "@/features/gists/queries";
import type { EditorMode } from "@/router";
import {
  detectDateFormat,
  generateDateFilename,
  groupFilesByDate,
  isDateBasedGist,
  parseDateFilename,
} from "@/shared/dates";
import { EmojiInput } from "@/shared/EmojiInput";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shared/ui/input-group";
import { getGistDescription, isDailyNote } from "@/shared/github";
import { ScrollableText } from "@/shared/ScrollableText";
import { Button } from "@/shared/ui/button";
import { CountBadge } from "@/shared/ui/count-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Toggle } from "@/shared/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
  Calendar,
  Check,
  ChevronDown,
  Columns2,
  ExternalLink,
  Eye,
  FileText,
  Fullscreen,
  History,
  Link,
  MessageSquare,
  MoreHorizontal,
  PanelLeftOpen,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import AddFileDialog from "../dialogs/AddFileDialog";
import {
  readDocumentContent,
  useIsSaving,
  useOpenDocument,
  useSaveDocument,
  type GistDocument,
} from "../document";
import { RevisionItems } from "../history/RevisionSelector";
import { useEditorMode } from "../mode";
import { mobileSidebarOpenAtom, revisionAtom, useDraft, zenModeAtom } from "../store";

/** The state and actions that both the desktop and mobile toolbars use. */
function useToolbar(doc: GistDocument) {
  const [mode, setMode] = useEditorMode();
  const navigate = useNavigate();
  const isCommentsOpen = useSelector(commentsPanelOpenAtom);
  const revisionId = useSelector(revisionAtom);
  const hasChanges = !!useDraft(doc.documentKey);
  const { comments, isEnabled: isCommentsEnabled } = useCommentThreads(doc);
  const aiReview = useAiReview(doc.documentKey);

  return {
    mode,
    setMode,
    isCommentsOpen,
    isViewingRevision: !!revisionId,
    hasChanges,
    isDisabled: !doc.gistId || doc.isLoading,
    canViewHistory: !doc.isReadOnly && !!doc.gist && !isDailyNote(doc.gist),
    commentCount: comments.length + (aiReview?.comments.length ?? 0),
    isCommentsEnabled,
    // Deleting the README deletes the whole gist
    deletesGist:
      doc.filename === "README.md" || (!!doc.gist && deletesGist(doc.gist, doc.filename)),

    copyUrl: () => {
      navigator.clipboard.writeText(location.href);
      toast.success("URL copied to clipboard!");
    },
    copyHtml: async () => {
      const { copyAsHtml } = await import("@/features/markdown/toHtml");
      await copyAsHtml(readDocumentContent(doc));
      toast.success("HTML copied to clipboard!");
    },
    openInGitHub: () => {
      const fileAnchor =
        doc.filename === "README.md" ? "" : `#file-${doc.filename.replace(/\./g, "-")}`;
      window.open(`https://gist.github.com/${doc.gistId}${fileAnchor}`, "_blank");
    },
    viewFullscreen: () =>
      navigate({
        to: "/share/$gistId/{-$filePath}",
        params: { gistId: doc.gistId!, filePath: doc.filename },
      }),
    requestDelete: () =>
      doc.gist && deleteGistDialog.openWithPayload({ gist: doc.gist, filename: doc.filename }),
  };
}

/** Selects one of the gist's files (grouping date-based files by year and month). */
function FileMenu({ doc, title }: { doc: GistDocument; title: ReactNode }) {
  const openDocument = useOpenDocument();
  const [isAddingFile, setIsAddingFile] = useState(false);
  const addFile = useAddAndOpenFile();

  const filenames = Object.keys(doc.gist?.files ?? {}).filter((name) => name.endsWith(".md"));
  const dateGroups = groupFilesByDate(filenames);
  const dateFormat = detectDateFormat(filenames);

  const fileItem = (
    filename: string,
    label: ReactNode = filename.replace(/\.md$/, ""),
    icon = <FileText />,
  ) => (
    <DropdownMenuItem
      key={filename}
      onClick={() => openDocument(doc.gistId, filename)}
      className={filename === doc.filename ? "bg-primary text-primary-foreground" : ""}
    >
      {icon}
      {label}
    </DropdownMenuItem>
  );

  // Highlights the submenus that contain the open file (while they're closed)
  const containsOpenFile = (files: string[]) =>
    files.includes(doc.filename)
      ? "not-data-popup-open:bg-primary not-data-popup-open:text-primary-foreground"
      : "";

  const byDescendingNumber = (a: string, b: string) => Number(b) - Number(a);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="h-8 gap-2 px-1 min-w-0 shrink" />}
        >
          <ChevronDown />
          {title}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {Object.entries(dateGroups?.groups ?? {})
            .sort(([a], [b]) => byDescendingNumber(a, b))
            .map(([year, months]) => (
              <DropdownMenuSub key={year}>
                <DropdownMenuSubTrigger className={containsOpenFile(Object.values(months).flat())}>
                  <Calendar /> {year}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {Object.entries(months)
                    .sort(([a], [b]) => byDescendingNumber(a, b))
                    .map(([month, files]) => (
                      <DropdownMenuSub key={month}>
                        <DropdownMenuSubTrigger className={containsOpenFile(files)}>
                          <Calendar />
                          {new Date(Number(year), Number(month) - 1).toLocaleString(undefined, {
                            month: "long",
                          })}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-0">
                          {files.map((filename) =>
                            fileItem(
                              filename,
                              parseDateFilename(filename, dateFormat!)?.day,
                              <Calendar />,
                            ),
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          {(dateGroups?.otherFiles.sort() ?? filenames).map((filename) => fileItem(filename))}
          {!doc.isReadOnly && (
            <>
              {filenames.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => setIsAddingFile(true)}>
                <Plus />
                Add new file
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isAddingFile && (
        <AddFileDialog
          defaultFilename={dateFormat ? generateDateFilename(dateFormat) : ""}
          onClose={() => setIsAddingFile(false)}
          onSubmit={(filename) => addFile(doc.gistId!, filename)}
        />
      )}
    </>
  );
}

/** Edits the gist's description (for its README), or the name of the open file. */
function TitleEditor({
  doc,
  initialValue,
  onDone,
}: {
  doc: GistDocument;
  initialValue: string;
  onDone: () => void;
}) {
  const isReadme = doc.filename === "README.md";
  const [value, setValue] = useState(initialValue);
  const { mutate: updateDescription } = useUpdateGistDescription();
  const { mutateAsync: renameFile } = useRenameGistFile();
  const save = useSaveDocument(doc);
  const openDocument = useOpenDocument();

  const submit = async () => {
    onDone();
    if (isReadme) return updateDescription({ gist: doc.gist!, description: value });

    const newFilename = value.endsWith(".md") ? value : `${value}.md`;
    if (!value || newFilename === doc.filename) return;

    // Save any changes first, so they aren't saved to the old filename after it's renamed.
    await save();
    await renameFile({ gistId: doc.gistId!, filename: doc.filename, newFilename });
    await openDocument(doc.gistId, newFilename);
  };

  return (
    <InputGroup className={`h-8 ${isReadme ? "max-w-md" : "max-w-[260px]"}`}>
      {isReadme ? (
        <EmojiInput
          value={value}
          onValueChange={setValue}
          onEnter={submit}
          onEscape={onDone}
          autoFocus
        />
      ) : (
        <InputGroupInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onDone();
          }}
          autoFocus
        />
      )}
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" onClick={submit} disabled={!value} title="Save">
          <Check className="text-green-500" />
        </InputGroupButton>
        <InputGroupButton size="icon-xs" onClick={onDone} title="Cancel">
          <X className="text-red-500" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

function DesktopActions({ doc, onSave }: { doc: GistDocument; onSave: () => void }) {
  const toolbar = useToolbar(doc);
  const isSaving = useIsSaving(doc);
  const { mode, setMode, isDisabled, isViewingRevision } = toolbar;

  return (
    <>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[mode]}
        onValueChange={([value]) => value && setMode(value as EditorMode)}
        disabled={isDisabled}
      >
        <ToggleGroupItem value="edit" title="Edit mode">
          <Pencil className="h-3.5 w-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="split" title="Split mode">
          <Columns2 className="h-3.5 w-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="preview" title="Preview mode">
          <Eye className="h-3.5 w-3.5" />
        </ToggleGroupItem>
      </ToggleGroup>

      {toolbar.isCommentsEnabled && (
        <Toggle
          size="sm"
          pressed={toolbar.isCommentsOpen}
          onPressedChange={(pressed) => (pressed ? openComments() : closeComments())}
          disabled={isDisabled || isViewingRevision}
          className="relative"
          aria-label="Comments"
        >
          <MessageSquare />
          <CountBadge count={toolbar.commentCount} />
        </Toggle>
      )}

      {toolbar.canViewHistory && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isDisabled}
            render={
              <Toggle
                size="sm"
                pressed={isViewingRevision}
                className="-mr-2 -ml-1"
                aria-label="History"
              />
            }
          >
            <History />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto min-w-60">
            <RevisionItems doc={doc} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isDisabled || isViewingRevision}
          render={<Button variant="ghost" size="sm" className="gap-0.5" title="Share options" />}
        >
          <ExternalLink />
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={toolbar.copyUrl}>
            <Link /> Copy URL
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toolbar.copyHtml}>
            <FileText /> Copy as HTML
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              zenModeAtom.set(true);
              setMode("split");
            }}
          >
            <Eye /> Enter Zen Mode
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toolbar.viewFullscreen}>
            <Fullscreen /> View Fullscreen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toolbar.openInGitHub}>
            <ExternalLink /> Open in GitHub
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button onClick={onSave} disabled={isDisabled || !toolbar.hasChanges || isSaving}>
        <Save />
        Save
      </Button>

      {!doc.isReadOnly && (
        <Button variant="destructive" onClick={toolbar.requestDelete} disabled={isDisabled}>
          <Trash2 />
          Delete
        </Button>
      )}
    </>
  );
}

function MobileActions({
  doc,
  onSave,
  onEditTitle,
}: {
  doc: GistDocument;
  onSave: () => void;
  onEditTitle: () => void;
}) {
  const toolbar = useToolbar(doc);
  const { mode, setMode, isCommentsOpen, isDisabled, isViewingRevision } = toolbar;

  return (
    <>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        className="mr-1"
        value={[isCommentsOpen ? "comments" : mode]}
        onValueChange={([value]) => {
          if (!value) return;
          if (value === "comments") return openComments();

          closeComments();
          setMode(value as EditorMode);
        }}
        disabled={isDisabled}
      >
        <ToggleGroupItem value="edit" aria-label="Show editor">
          <Pencil className="h-3.5 w-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="preview" aria-label="Show preview">
          <Eye className="h-3.5 w-3.5" />
        </ToggleGroupItem>
        {toolbar.isCommentsEnabled && (
          <ToggleGroupItem
            value="comments"
            aria-label="Show comments"
            disabled={isViewingRevision}
            className="relative"
          >
            <MessageSquare />
            <CountBadge count={toolbar.commentCount} />
          </ToggleGroupItem>
        )}
      </ToggleGroup>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isDisabled}
          render={<Button variant="ghost" size="icon-sm" aria-label="More" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {mode !== "preview" && !isCommentsOpen && (
            <DropdownMenuItem onClick={onEditTitle} disabled={doc.isReadOnly}>
              <Pencil /> Edit description
            </DropdownMenuItem>
          )}
          {toolbar.canViewHistory && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <History /> History
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-auto min-w-60">
                <RevisionItems doc={doc} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={isViewingRevision} onClick={toolbar.copyUrl}>
            <Link /> Copy URL
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isViewingRevision} onClick={toolbar.viewFullscreen}>
            <Fullscreen /> View Fullscreen
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isViewingRevision} onClick={toolbar.openInGitHub}>
            <ExternalLink /> Open in GitHub
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSave} disabled={!toolbar.hasChanges}>
            <Save /> Save
          </DropdownMenuItem>
          {!doc.isReadOnly && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={toolbar.requestDelete}>
                <Trash2 /> {toolbar.deletesGist ? "Delete gist" : "Delete file"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export default function EditorToolbar({ doc, onSave }: { doc: GistDocument; onSave: () => void }) {
  const isMobile = useIsMobile();
  const isAiInProgress = useIsAiInProgress();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const starredGists = useStarredGists();
  const { mutate: toggleStarred } = useToggleStarred();

  const gist = doc.gist;
  const isReadme = doc.filename === "README.md";
  const isStarred = starredGists.some(({ id }) => id === doc.gistId);

  // The README's title is the gist's description, and otherwise, it's the file's name
  const name = isReadme
    ? gist
      ? getGistDescription(gist)
      : ""
    : doc.filename.replace(/\.md$/, "");
  const title = (
    <h2 className="text-lg font-semibold flex gap-2 items-center min-w-0">
      {!isReadme && gist && isDateBasedGist(gist) && <Calendar className="h-4 w-4 shrink-0" />}
      <ScrollableText>
        <span className={isAiInProgress ? "ai-gradient-text" : ""}>
          {name || (
            <span className={`italic${isAiInProgress ? "" : " text-muted-foreground"}`}>
              Untitled
            </span>
          )}
        </span>
      </ScrollableText>
    </h2>
  );

  return (
    <div className="border-b p-2.5 flex justify-between items-center gap-2 bg-muted/30">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {/* On mobile, the gist list replaces the editor (rather than being beside it) */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => mobileSidebarOpenAtom.set(true)}
            title="Show gists"
          >
            <PanelLeftOpen />
          </Button>
        )}
        {gist &&
          (isEditingTitle ? (
            <TitleEditor doc={doc} initialValue={name} onDone={() => setIsEditingTitle(false)} />
          ) : (
            <>
              {(!doc.isReadOnly || Object.keys(gist.files).length > 1) && !isDailyNote(gist) ? (
                <FileMenu doc={doc} title={title} />
              ) : (
                <div className="pl-2 min-w-0">{title}</div>
              )}
              {!doc.isLoading &&
                !isMobile &&
                (doc.isReadOnly ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggleStarred({ gist, isStarred })}
                    title={isStarred ? "Unstar gist" : "Star gist"}
                  >
                    <Star className={`text-yellow-400 ${isStarred ? "fill-yellow-400" : ""}`} />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setIsEditingTitle(true)}
                    title={isReadme ? "Edit description" : "Rename file"}
                  >
                    <Pencil className="text-blue-500" />
                  </Button>
                ))}
            </>
          ))}
      </div>

      <div className="flex gap-2 items-center shrink-0">
        {isMobile ? (
          !isEditingTitle && (
            <MobileActions doc={doc} onSave={onSave} onEditTitle={() => setIsEditingTitle(true)} />
          )
        ) : (
          <DesktopActions doc={doc} onSave={onSave} />
        )}
      </div>
    </div>
  );
}
