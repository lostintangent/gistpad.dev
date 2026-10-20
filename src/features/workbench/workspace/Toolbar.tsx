import { useIsAgentRunning } from "@/features/agent/model/store";
import { useAddAndOpenFile } from "@/features/gists/actions";
import { CommandButton } from "@/features/commands/CommandButton";
import { CommandDropdownItem } from "@/features/commands/CommandDropdownItem";
import { executeCommand } from "@/features/commands/registry";
import { useRenameFile, useUpdateGistDescription } from "@/features/gists/queries";
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
import {
  Calendar,
  Check,
  ChevronDown,
  Columns2,
  ExternalLink,
  Eye,
  FileText,
  History,
  MessageSquare,
  MoreHorizontal,
  PanelLeftOpen,
  Pencil,
  Star,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import AddFileDialog from "./dialogs/AddFileDialog";
import { openFile, useSaveFile, type ActiveFile } from "@/features/files/file";
import { RevisionItems } from "./history/RevisionItems";
import { isEditorMode } from "../layout/mode";
import { mobilePanelAtom } from "../layout/state";
import type { WorkspaceCommands } from "./commands";

/** The menu items for sharing the file (or viewing it elsewhere). */
function ShareItems({ share }: { share: WorkspaceCommands["share"] }) {
  const isMobile = useIsMobile();

  return (
    <>
      <CommandDropdownItem command={share.copyUrl} />
      <CommandDropdownItem command={share.copyHtml} />
      <DropdownMenuSeparator />
      {/* (Zen mode shows the editor and preview side by side, which mobile screens don't have room for) */}
      {!isMobile && <CommandDropdownItem command={share.zen} />}
      <CommandDropdownItem command={share.fullscreen} />
      <DropdownMenuSeparator />
      <CommandDropdownItem command={share.github} />
    </>
  );
}

/** Selects one of the gist's files (grouping date-based files by year and month). */
function FileMenu({
  file,
  title,
  commands,
}: {
  file: ActiveFile;
  title: ReactNode;
  commands: WorkspaceCommands;
}) {
  const isMobile = useIsMobile();

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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="h-8 gap-2 px-2 min-w-0 shrink" />}
      >
        {title}
        {/* The chevron trails the title, like a menu's (rather than leading it, like a section's).
            On mobile, there's no room for it beside the "Show gists" button. */}
        {!isMobile && <ChevronDown className="text-muted-foreground" />}
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
            <CommandDropdownItem command={commands.addFile} />
            <CommandDropdownItem command={commands.editTitle} />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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

function DesktopActions({ file, toolbar }: { file: ActiveFile; toolbar: WorkspaceCommands }) {
  const { mode, isDisabled, isViewingRevision } = toolbar;

  return (
    <>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[mode]}
        onValueChange={([value]) => {
          if (isEditorMode(value)) void executeCommand(toolbar.view[value]);
        }}
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
          onPressedChange={() => void executeCommand(toolbar.comments)}
          disabled={toolbar.comments.disabled}
          className="relative"
          aria-label="Comments"
        >
          <MessageSquare />
          <CountBadge
            count={toolbar.commentCount}
            className="-top-[2px] -right-[2px] ring-2 ring-[color:var(--toolbar-background)]"
          />
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
          <ShareItems share={toolbar.share} />
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandButton command={toolbar.save} />

      {toolbar.delete && <CommandButton command={toolbar.delete} variant="destructive" />}
    </>
  );
}

function MobileActions({ file, toolbar }: { file: ActiveFile; toolbar: WorkspaceCommands }) {
  const { mode, isCommentsOpen, isDisabled, isViewingRevision } = toolbar;

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
          if (value === "comments") return void executeCommand(toolbar.comments);

          if (isEditorMode(value)) void executeCommand(toolbar.view[value]);
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
            <CountBadge
              count={toolbar.commentCount}
              className="-top-[2px] -right-[2px] ring-2 ring-[color:var(--toolbar-background)]"
            />
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
          <CommandDropdownItem command={toolbar.save} />
          <DropdownMenuSeparator />
          <ShareItems share={toolbar.share} />
          {/* (On mobile, the sidebar's footer is slid away, so the dashboard can be opened here too) */}
          <DropdownMenuSeparator />
          <CommandDropdownItem command="view.dashboard" />
          {toolbar.delete && (
            <>
              <DropdownMenuSeparator />
              <CommandDropdownItem command={toolbar.delete} variant="destructive" />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export default function Toolbar({
  file,
  hidden,
  commands: toolbar,
}: {
  file: ActiveFile;
  /** Whether the toolbar is hidden (in zen mode), while its commands stay registered. */
  hidden: boolean;
  commands: WorkspaceCommands;
}) {
  const isMobile = useIsMobile();
  const isAgentRunning = useIsAgentRunning();
  const { isEditingTitle, isAddingFile } = toolbar;
  const addFile = useAddAndOpenFile();

  const gist = file.gist;
  const dateFormat = detectDateFormat(getMarkdownFiles(gist));

  // The README's title is the gist's description, and otherwise, it's the file's name
  const name = file.isReadme
    ? gist
      ? getGistDescription(gist)
      : ""
    : getFileDisplayName(file.filename);
  // On desktop, double-clicking the title edits it. That's caught at the second press, which would
  // otherwise toggle the file menu (that the first press opened), so the menu closes with the title.
  const canEditTitle = !toolbar.editTitle.disabled && !isMobile;
  const title = (
    <h2
      className="text-lg font-semibold flex gap-2 items-center min-w-0"
      onMouseDown={(event) => {
        if (!canEditTitle || event.detail !== 2) return;
        event.stopPropagation();
        void executeCommand(toolbar.editTitle);
      }}
    >
      {!file.isReadme && gist && isDateBasedGist(gist) && <Calendar className="h-4 w-4 shrink-0" />}
      <ScrollableText>
        <span className={isAgentRunning ? "agent-gradient-text" : ""}>
          {name || (
            <span className={`italic${isAgentRunning ? "" : " text-muted-foreground"}`}>
              Untitled
            </span>
          )}
        </span>
      </ScrollableText>
    </h2>
  );

  // An opaque toolbar surface lets overlaid badge rings match its background exactly.
  return (
    <div
      hidden={hidden}
      className="border-b p-2.5 flex justify-between items-center gap-2 bg-(--toolbar-background) [--toolbar-background:color-mix(in_srgb,var(--muted)_30%,var(--background))]"
    >
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
            <TitleEditor file={file} initialValue={name} onDone={toolbar.stopEditing} />
          ) : (
            <>
              {(!file.isReadOnly || Object.keys(gist.files).length > 1) && !isDailyNote(gist) ? (
                <FileMenu file={file} title={title} commands={toolbar} />
              ) : (
                // (Inset like the menu's trigger, so the title doesn't move between gists)
                <div className="px-2 min-w-0">{title}</div>
              )}
              {!file.isLoading && !isMobile && file.isReadOnly && toolbar.gist && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => toolbar.gist && void executeCommand(toolbar.gist.star)}
                  title={toolbar.gist.star.title}
                >
                  <Star
                    className={`text-yellow-400 ${toolbar.gist.star.checked ? "fill-yellow-400" : ""}`}
                  />
                </Button>
              )}
            </>
          ))}
      </div>

      <div className="flex gap-2 items-center shrink-0">
        {isMobile ? (
          !isEditingTitle && <MobileActions file={file} toolbar={toolbar} />
        ) : (
          <DesktopActions file={file} toolbar={toolbar} />
        )}
      </div>

      {isAddingFile && (
        <AddFileDialog
          defaultFilename={dateFormat ? generateDateFilename(dateFormat) : ""}
          onClose={toolbar.stopEditing}
          onSubmit={(filename) => addFile(file.gistId!, filename)}
        />
      )}
    </div>
  );
}
