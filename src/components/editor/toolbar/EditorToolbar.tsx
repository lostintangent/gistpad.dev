import { editorModeAtom } from "@/atoms";
import { EmojiInput } from "@/components/editor/EmojiInput";
import { ScrollableText } from "@/components/ScrollableText";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useMobile";
import { GistRevision, isDailyNote, type Gist } from "@/lib/github";
import { groupFilesByDate, isDateBasedGist } from "@/lib/utils";
import { useAtom } from "jotai";
import {
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Pencil,
  Plus,
  Star,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import DesktopToolbar from "./DesktopToolbar";
import MobileToolbar from "./MobileToolbar";

// TODO: Look into reducing the number of props passed to this component
export interface EditorToolbarProps {
  gistId?: string;
  gist?: Gist | null;

  description: string;
  isEditingDescription: boolean;
  setIsEditingDescription: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateDescription: (description: string) => Promise<void>;

  isEditingFilename: boolean;
  setIsEditingFilename: React.Dispatch<React.SetStateAction<boolean>>;

  selectedFile: string;
  onSelectFile?: (filename: string) => void;

  isCommentsEnabled?: boolean;
  commentsCount: number;
  isCommentSidebarOpen: boolean;
  setIsCommentSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;

  isReadOnly: boolean;
  isLoading: boolean;
  isStarred?: boolean;

  onStarToggle?: (gistId: string) => Promise<void>;
  onRenameFile?: (oldFilename: string, newFilename: string) => Promise<void>;

  selectedRevisionId?: string | null;
  onSelectRevision?: (revisionId: string | null) => void;
  revisions?: GistRevision[] | null;
  isRevisionsLoading: boolean;

  setShowDeleteDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowForkDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAddFileDialog: React.Dispatch<React.SetStateAction<boolean>>;

  hasUnsavedChanges?: boolean;
  isSaving: boolean;
  handleSaveWithForkCheck: () => Promise<void>;
  isDeletingFile: boolean;

  /** Whether an AI command is currently running */
  isCommandInProgress?: boolean;

  handleCopyGistUrl: (showToast?: boolean) => void;
  handleCopyGistHtml: () => Promise<void>;
  handleOpenInGithub: () => void;
  onViewFullscreen?: () => void;
  onToggleZenMode: () => void;
}

export default ({
  gistId,
  gist,
  description,
  isEditingDescription,
  setIsEditingDescription,
  onUpdateDescription,
  isEditingFilename,
  setIsEditingFilename,
  selectedFile,
  onSelectFile,
  isCommentSidebarOpen,
  setIsCommentSidebarOpen,
  isReadOnly,
  isLoading,
  isStarred,
  onStarToggle,
  onRenameFile,
  selectedRevisionId,
  onSelectRevision,
  revisions,
  isRevisionsLoading,
  setShowDeleteDialog,
  setShowAddFileDialog,
  hasUnsavedChanges,
  isSaving,
  handleSaveWithForkCheck,
  isDeletingFile,
  isCommandInProgress,
  isCommentsEnabled,
  commentsCount,
  handleCopyGistUrl,
  handleCopyGistHtml,
  handleOpenInGithub,
  onViewFullscreen,
  onToggleZenMode,
}: EditorToolbarProps) => {
  const [currentDescription, setCurrentDescription] = useState(
    description || ""
  );

  const [currentFilename, setCurrentFilename] = useState("");

  useEffect(() => {
    setCurrentDescription(description);
  }, [description]);

  const isMobile = useIsMobile();
  const [editorMode, setEditorMode] = useAtom(editorModeAtom);

  const isPreviewMode = editorMode === "preview";

  const fileCount = gistId && gist ? Object.keys(gist.files).length : 0;
  const filteredFiles = gistId
    ? Object.keys(gist?.files || {}).filter((filename) =>
      filename.endsWith(".md")
    )
    : [];

  const isDailyNoteGist = gist && isDailyNote(gist);

  const commandTitleClass = isCommandInProgress
    ? "bg-linear-to-r from-green-400 to-purple-600 bg-clip-text text-transparent animate-gradient-pulse"
    : "";

  const handleFilenameKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (!gistId || !gist || !currentFilename) return;
        setIsEditingFilename(false);

        try {
          const newFilename = currentFilename.endsWith(".md")
            ? currentFilename
            : `${currentFilename}.md`;
          const oldFilename = selectedFile;
          await onRenameFile(oldFilename, newFilename);
          setCurrentFilename(""); // Reset the state after successful rename
        } catch (error) {
          setCurrentFilename(selectedFile.replace(/\.md$/, ""));
        }
      } else if (e.key === "Escape") {
        setCurrentFilename(""); // Reset the state when canceling
        setIsEditingFilename(false);
      }
    },
    [currentFilename, selectedFile, gistId, onRenameFile, gist]
  );

  return (
    <div className="border-b p-[0.63rem] flex justify-between items-center bg-muted/30">
      {/* Gist title and file list */}
      <div className="flex items-center gap-2 flex-1">
        {isEditingDescription ? (
          <div className="flex items-center gap-2">
            <EmojiInput
              value={currentDescription}
              onValueChange={setCurrentDescription}
              onChange={(e) => setCurrentDescription(e.target.value)}
              onEnter={() => onUpdateDescription(currentDescription)}
              onEscape={() => {
                setCurrentDescription(description);
                setIsEditingDescription(false);
              }}
              className="max-w-md"
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateDescription(currentDescription)}
              className="h-6 w-6"
            >
              <Check className="h-4 w-4 text-green-500" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentDescription(description);
                setIsEditingDescription(false);
              }}
              className="h-6 w-6"
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : (
          gistId && (
            <div className="flex items-center gap-1">
              {(!isReadOnly || fileCount > 1) &&
                !isDailyNoteGist &&
                !isEditingFilename ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 p-1!"
                    >
                      <ChevronDown className="h-4 w-4" />
                      <h2
                        className={`text-lg font-semibold flex gap-2 items-center${isMobile ? " max-w-[220px] truncate" : ""
                          }`}
                      >
                        {selectedFile === "README.md" ? (
                          <ScrollableText>
                            <span className={commandTitleClass}>
                              {currentDescription ? (
                                currentDescription
                              ) : (
                                <span
                                  className={`italic${isCommandInProgress ? "" : " text-muted-foreground"}`}
                                >
                                  Untitled
                                </span>
                              )}
                            </span>
                          </ScrollableText>
                        ) : (
                          <>
                            {isDateBasedGist(gist) && (
                              <Calendar className="h-4 w-4" />
                            )}
                            <ScrollableText>
                              <span className={commandTitleClass}>
                                {selectedFile.replace(/\.md$/, "")}
                              </span>
                            </ScrollableText>
                          </>
                        )}
                      </h2>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(() => {
                      const result = groupFilesByDate(filteredFiles);
                      if (result) {
                        const { groups, otherFiles } = result;
                        const groupedItems = Object.keys(groups)
                          .sort((a, b) => Number(b) - Number(a))
                          .map((year) => (
                            <DropdownMenuSub key={year}>
                              <DropdownMenuSubTrigger
                                className={
                                  groups[year] &&
                                    Object.values(groups[year])
                                      .flat()
                                      .includes(selectedFile)
                                    ? "data-[state=closed]:bg-primary data-[state=closed]:text-primary-foreground"
                                    : ""
                                }
                              >
                                <Calendar className="h-4 w-4 mr-2" /> {year}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {Object.keys(groups[year])
                                  .sort((a, b) => Number(b) - Number(a))
                                  .map((month) => (
                                    <DropdownMenuSub key={month}>
                                      <DropdownMenuSubTrigger
                                        className={
                                          groups[year][month].includes(
                                            selectedFile
                                          )
                                            ? "data-[state=closed]:bg-primary data-[state=closed]:text-primary-foreground"
                                            : ""
                                        }
                                      >
                                        <Calendar className="h-4 w-4 mr-2" />{" "}
                                        {new Date(
                                          Number(year),
                                          Number(month) - 1,
                                          1
                                        ).toLocaleString(undefined, {
                                          month: "long",
                                        })}
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="min-w-0">
                                        {groups[year][month].map((filename) => (
                                          <DropdownMenuItem
                                            key={filename}
                                            onClick={() =>
                                              onSelectFile?.(filename)
                                            }
                                            className={`gap-2${filename === selectedFile ? " bg-primary text-primary-foreground" : ""}`}
                                          >
                                            <Calendar className="h-4 w-4" />
                                            {new Date(
                                              filename.replace(".md", "")
                                            ).getUTCDate()}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          ));
                        const otherItems = otherFiles.sort().map((filename) => (
                          <DropdownMenuItem
                            key={filename}
                            onClick={() => onSelectFile?.(filename)}
                            className={`gap-2${filename === selectedFile ? " bg-primary text-primary-foreground" : ""}`}
                          >
                            <FileText className="h-4 w-4" />
                            {filename.replace(/\.md$/, "")}
                          </DropdownMenuItem>
                        ));
                        return (
                          <>
                            {groupedItems}
                            {otherItems}
                          </>
                        );
                      }
                      return filteredFiles.map((filename) => (
                        <DropdownMenuItem
                          key={filename}
                          onClick={() => onSelectFile?.(filename)}
                          className={`gap-2${filename === selectedFile ? " bg-primary text-primary-foreground" : ""}`}
                        >
                          <FileText className="h-4 w-4" />
                          {filename.replace(/\.md$/, "")}
                        </DropdownMenuItem>
                      ));
                    })()}
                    {!isReadOnly && (
                      <>
                        {filteredFiles.length > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onSelect={() => {
                            // Note: Without this timeout in place, the dialog
                            // doesn't properly receive focus and then the page gets
                            // into a state where you can't click anything. I hate
                            // that I need to have this, but I'm not aware of a solution.
                            setTimeout(() => setShowAddFileDialog(true), 200);
                          }}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add new file
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : !isEditingFilename && !isEditingDescription ? (
                <h2 className="text-lg font-semibold pl-2">
                  {selectedFile === "README.md" ? (
                    <ScrollableText>
                      <span className={commandTitleClass}>
                        {currentDescription ? (
                          currentDescription
                        ) : (
                          <span
                            className={`italic${isCommandInProgress ? "" : " text-muted-foreground"}`}
                          >
                            Untitled
                          </span>
                        )}
                      </span>
                    </ScrollableText>
                  ) : (
                    <ScrollableText>
                      <span className={commandTitleClass}>
                        {selectedFile.replace(/\.md$/, "")}
                      </span>
                    </ScrollableText>
                  )}
                </h2>
              ) : null}
              {gistId &&
                !isLoading &&
                !isMobile &&
                (isReadOnly ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStarToggle?.(gistId)}
                    className="h-6 w-6"
                  >
                    <Star
                      className={`h-4 w-4 ${isStarred
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-yellow-400"
                        }`}
                    />
                  </Button>
                ) : (
                  <>
                    {isEditingFilename ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={currentFilename.replace(/\.md$/, "")}
                          onChange={(e) => setCurrentFilename(e.target.value)}
                          onKeyDown={handleFilenameKeyDown}
                          className="max-w-[200px] h-6"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleFilenameKeyDown({
                              key: "Enter",
                            } as React.KeyboardEvent)
                          }
                          className="h-6 w-6"
                          disabled={!currentFilename}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentFilename(""); // Reset the state when canceling
                            setIsEditingFilename(false);
                          }}
                          className="h-6 w-6"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedFile === "README.md") {
                            setIsEditingDescription(true);
                          } else {
                            setCurrentFilename(
                              selectedFile.replace(/\.md$/, "")
                            );
                            setIsEditingFilename(true);
                          }
                        }}
                        className="h-6 w-6"
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                    )}
                  </>
                ))}
            </div>
          )
        )}
      </div>

      {/* Editor command bar (mobile vs. desktop) */}
      <div className="flex gap-2 items-center">
        {isMobile ? (
          <MobileToolbar
            isEditingDescription={isEditingDescription}
            isEditingFilename={isEditingFilename}
            isCommentSidebarOpen={isCommentSidebarOpen}
            setIsCommentSidebarOpen={setIsCommentSidebarOpen}
            isPreviewMode={isPreviewMode}
            setEditorMode={setEditorMode}
            isCommentsEnabled={isCommentsEnabled}
            commentsCount={commentsCount}
            selectedRevisionId={selectedRevisionId}
            gistId={gistId}
            isLoading={isLoading}
            setIsEditingDescription={setIsEditingDescription}
            isReadOnly={isReadOnly}
            revisions={revisions}
            gistCreatedAt={gist?.created_at}
            onSelectRevision={onSelectRevision}
            isRevisionsLoading={isRevisionsLoading}
            handleCopyGistUrl={handleCopyGistUrl}
            onViewFullscreen={onViewFullscreen}
            handleOpenInGithub={handleOpenInGithub}
            handleSaveWithForkCheck={handleSaveWithForkCheck}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            setShowDeleteDialog={setShowDeleteDialog}
            isDeletingFile={isDeletingFile}
          />
        ) : (
          <DesktopToolbar
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            gistId={gistId}
            isLoading={isLoading}
            isCommentsEnabled={isCommentsEnabled}
            isCommentSidebarOpen={isCommentSidebarOpen}
            setIsCommentSidebarOpen={setIsCommentSidebarOpen}
            selectedRevisionId={selectedRevisionId}
            commentsCount={commentsCount}
            isReadOnly={isReadOnly}
            isDailyNoteGist={isDailyNoteGist}
            revisions={revisions}
            gistCreatedAt={gist?.created_at}
            onSelectRevision={onSelectRevision}
            isRevisionsLoading={isRevisionsLoading}
            handleCopyGistUrl={handleCopyGistUrl}
            handleCopyGistHtml={handleCopyGistHtml}
            onToggleZenMode={onToggleZenMode}
            onViewFullscreen={onViewFullscreen}
            handleOpenInGithub={handleOpenInGithub}
            handleSaveWithForkCheck={handleSaveWithForkCheck}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            setShowDeleteDialog={setShowDeleteDialog}
          />
        )}
      </div>
    </div>
  );
};
