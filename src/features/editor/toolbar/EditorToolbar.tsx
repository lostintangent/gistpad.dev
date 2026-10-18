import { useAiReview, useIsAiInProgress } from "@/features/ai/store";
import { closeComments, commentsPanelOpenAtom, openComments } from "@/features/comments/store";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { deletesGist, useAddAndOpenFile } from "@/features/gists/actions";
import { deleteGistDialog } from "@/features/gists/dialogs/DeleteGistDialog";
import {
  useIsStarred,
  useRenameFile,
  useToggleStarred,
  useUpdateGistDescription,
} from "@/features/gists/queries";
import {
  detectDateFormat,
  generateDateFilename,
  groupFilesByDate,
  parseDateFilename,
} from "@/shared/dates";
import { EmojiInput } from "@/shared/EmojiInput";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shared/ui/input-group";
import {
  getFileDisplayName,
  getGistDescription,
  getMarkdownFiles,
  isDailyNote,
  isDateBasedGist,
  toMarkdownFilename,
} from "@/shared/github";
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
  Newspaper,
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
  readFileContent,
  useIsSaving,
  openFile,
  useSaveFile,
  type ActiveFile,
} from "@/features/files/file";
import { useIsViewingRevision } from "../history/revision";
import { RevisionItems } from "../history/RevisionItems";
import { useEditorMode, type EditorMode } from "../mode";
import { mobilePanelAtom, zenModeAtom } from "../layout";
import { useDraft } from "@/features/files/draft";

/** The state that both the desktop and mobile toolbars reflect. */
function useToolbar(file: ActiveFile) {
  const [mode, setMode] = useEditorMode();
  const isCommentsOpen = useSelector(commentsPanelOpenAtom);
  const isViewingRevision = useIsViewingRevision();
  const hasChanges = !!useDraft(file);
  const { comments, isEnabled: isCommentsEnabled } = useCommentThreads(file);
  const aiReview = useAiReview(file.key);

  return {
    mode,
    setMode,
    isCommentsOpen,
    isViewingRevision,
    hasChanges,
    isDisabled: !file.gistId || file.isLoading,
    canViewHistory: !file.isReadOnly && !!file.gist && !isDailyNote(file.gist),
    commentCount: comments.length + (aiReview?.comments.length ?? 0),
    isCommentsEnabled,
    requestDelete: () =>
      file.gist && deleteGistDialog.openWithPayload({ gist: file.gist, filename: file.filename }),
  };
}

/** The menu items for sharing the file (or viewing it elsewhere). */
function ShareItems({ file, disabled = false }: { file: ActiveFile; disabled?: boolean }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [, setMode] = useEditorMode();

  const copyUrl = () => {
    navigator.clipboard.writeText(location.href);
    toast.success("URL copied to clipboard!");
  };

  const copyHtml = async () => {
    const { copyAsHtml } = await import("@/features/markdown/toHtml");
    await copyAsHtml(readFileContent(file));
    toast.success("HTML copied to clipboard!");
  };

  const openInGitHub = () => {
    const fileAnchor = file.isReadme ? "" : `#file-${file.filename.replace(/\./g, "-")}`;
    window.open(`https://gist.github.com/${file.gistId}${fileAnchor}`, "_blank");
  };

  return (
    <>
      <DropdownMenuItem disabled={disabled} onClick={copyUrl}>
        <Link /> Copy URL
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onClick={copyHtml}>
        <FileText /> Copy as HTML
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {/* (Zen mode shows the editor and preview side by side, which mobile screens don't have room for) */}
      {!isMobile && (
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => {
            zenModeAtom.set(true);
            setMode("split");
          }}
        >
          <Eye /> Enter Zen Mode
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        disabled={disabled}
        onClick={() =>
          navigate({
            to: "/share/$gistId/{-$filePath}",
            params: { gistId: file.gistId!, filePath: file.filename },
          })
        }
      >
        <Fullscreen /> View Fullscreen
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={disabled} onClick={openInGitHub}>
        <ExternalLink /> Open in GitHub
      </DropdownMenuItem>
    </>
  );
}

/** Selects one of the gist's files (grouping date-based files by year and month). */
function FileMenu({ file, title }: { file: ActiveFile; title: ReactNode }) {
  const isMobile = useIsMobile();
  const [isAddingFile, setIsAddingFile] = useState(false);
  const addFile = useAddAndOpenFile();

  const filenames = getMarkdownFiles(file.gist);
  const dateGroups = groupFilesByDate(filenames);
  const dateFormat = detectDateFormat(filenames);

  const fileItem = (
    filename: string,
    label: ReactNode = getFileDisplayName(filename),
    icon = <FileText />,
  ) => (
    <DropdownMenuItem
      key={filename}
      onClick={() => openFile(file.gistId, filename)}
      className={filename === file.filename ? "bg-primary text-primary-foreground" : ""}
    >
      {icon}
      {label}
    </DropdownMenuItem>
  );

  // Highlights the submenus that contain the open file (while they're closed)
  const containsOpenFile = (files: string[]) =>
    files.includes(file.filename)
      ? "not-data-popup-open:bg-primary not-data-popup-open:text-primary-foreground"
      : "";

  const byDescendingNumber = (a: string, b: string) => Number(b) - Number(a);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="h-8 gap-2 px-1 min-w-0 shrink" />}
        >
          {/* On mobile, the chevron looks out of place beside the "Show gists" button */}
          {!isMobile && <ChevronDown />}
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
          {!file.isReadOnly && (
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
          onSubmit={(filename) => addFile(file.gistId!, filename)}
        />
      )}
    </>
  );
}

/** Edits the gist's description (for its README), or the name of the open file. */
function TitleEditor({
  file,
  initialValue,
  onDone,
}: {
  file: ActiveFile;
  initialValue: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const { mutate: updateDescription } = useUpdateGistDescription();
  const { mutateAsync: renameFile } = useRenameFile();
  const save = useSaveFile(file);

  const submit = async () => {
    onDone();
    if (file.isReadme) return updateDescription({ gist: file.gist!, description: value });

    const newFilename = toMarkdownFilename(value);
    if (!value || newFilename === file.filename) return;

    // Save any changes first, so they aren't saved to the old filename after it's renamed.
    await save();
    await renameFile({ gistId: file.gistId!, filename: file.filename, newFilename });
    await openFile(file.gistId, newFilename);
  };

  return (
    <InputGroup className={`h-8 ${file.isReadme ? "max-w-md" : "max-w-[260px]"}`}>
      {file.isReadme ? (
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

function DesktopActions({ file, onSave }: { file: ActiveFile; onSave: () => void }) {
  const toolbar = useToolbar(file);
  const isSaving = useIsSaving(file);
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
          <DropdownMenuContent>
            <RevisionItems file={file} />
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
          <ShareItems file={file} />
        </DropdownMenuContent>
      </DropdownMenu>

      <Button onClick={onSave} disabled={isDisabled || !toolbar.hasChanges || isSaving}>
        <Save />
        Save
      </Button>

      {!file.isReadOnly && (
        <Button variant="destructive" onClick={toolbar.requestDelete} disabled={isDisabled}>
          <Trash2 />
          Delete
        </Button>
      )}
    </>
  );
}

function MobileActions({
  file,
  onSave,
  onEditTitle,
}: {
  file: ActiveFile;
  onSave: () => void;
  onEditTitle: () => void;
}) {
  const toolbar = useToolbar(file);
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
            <DropdownMenuItem onClick={onEditTitle} disabled={file.isReadOnly}>
              <Pencil /> Edit description
            </DropdownMenuItem>
          )}
          {toolbar.canViewHistory && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <History /> History
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <RevisionItems file={file} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem onClick={onSave} disabled={!toolbar.hasChanges}>
            <Save /> Save
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ShareItems file={file} disabled={isViewingRevision} />
          {/* (On mobile, the sidebar's footer is slid away, so the dashboard can be opened here too) */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => mobilePanelAtom.set("dashboard")}>
            <Newspaper /> Dashboard
          </DropdownMenuItem>
          {!file.isReadOnly && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={toolbar.requestDelete}>
                <Trash2 />
                {file.gist && deletesGist(file.gist, file.filename) ? "Delete gist" : "Delete file"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export default function EditorToolbar({ file, onSave }: { file: ActiveFile; onSave: () => void }) {
  const isMobile = useIsMobile();
  const isAiInProgress = useIsAiInProgress();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const { mutate: toggleStarred } = useToggleStarred();

  const gist = file.gist;
  const isStarred = useIsStarred(file.gistId);

  // The README's title is the gist's description, and otherwise, it's the file's name
  const name = file.isReadme
    ? gist
      ? getGistDescription(gist)
      : ""
    : getFileDisplayName(file.filename);
  const title = (
    <h2 className="text-lg font-semibold flex gap-2 items-center min-w-0">
      {!file.isReadme && gist && isDateBasedGist(gist) && <Calendar className="h-4 w-4 shrink-0" />}
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
        {/* On mobile, the gist list is slid away (until it's shown, beside the editor) */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => mobilePanelAtom.set("sidebar")}
            title="Show gists"
          >
            <PanelLeftOpen />
          </Button>
        )}
        {gist &&
          (isEditingTitle ? (
            <TitleEditor file={file} initialValue={name} onDone={() => setIsEditingTitle(false)} />
          ) : (
            <>
              {(!file.isReadOnly || Object.keys(gist.files).length > 1) && !isDailyNote(gist) ? (
                <FileMenu file={file} title={title} />
              ) : (
                <div className="pl-2 min-w-0">{title}</div>
              )}
              {!file.isLoading &&
                !isMobile &&
                (file.isReadOnly ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggleStarred(gist)}
                    title={isStarred ? "Unstar gist" : "Star gist"}
                  >
                    <Star className={`text-yellow-400 ${isStarred ? "fill-yellow-400" : ""}`} />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    onClick={() => setIsEditingTitle(true)}
                    title={file.isReadme ? "Edit description" : "Rename file"}
                  >
                    <Pencil />
                  </Button>
                ))}
            </>
          ))}
      </div>

      <div className="flex gap-2 items-center shrink-0">
        {isMobile ? (
          !isEditingTitle && (
            <MobileActions
              file={file}
              onSave={onSave}
              onEditTitle={() => setIsEditingTitle(true)}
            />
          )
        ) : (
          <DesktopActions file={file} onSave={onSave} />
        )}
      </div>
    </div>
  );
}
