import React from "react";
import type { EditorMode } from "@/atoms";
import type { GistRevision } from "@/lib/github";
import RevisionSelector from "@/components/editor/history/RevisionSelector";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChevronDown,
  Columns2,
  Eye,
  ExternalLink,
  FileText,
  Fullscreen,
  History,
  Link,
  MessageSquare,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";

interface DesktopToolbarProps {
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  gistId?: string;
  isLoading: boolean;
  isCommentsEnabled?: boolean;
  isCommentSidebarOpen: boolean;
  setIsCommentSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRevisionId?: string | null;
  commentsCount: number;
  isReadOnly: boolean;
  isDailyNoteGist?: boolean;
  revisions?: GistRevision[] | null;
  gistCreatedAt?: string;
  onSelectRevision?: (revisionId: string | null) => void;
  isRevisionsLoading: boolean;
  handleCopyGistUrl: (showToast?: boolean) => void;
  handleCopyGistHtml: () => Promise<void>;
  onToggleZenMode: () => void;
  onViewFullscreen?: () => void;
  handleOpenInGithub: () => void;
  handleSaveWithForkCheck: () => Promise<void>;
  hasUnsavedChanges?: boolean;
  isSaving: boolean;
  setShowDeleteDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

const DesktopToolbar = ({
  editorMode,
  setEditorMode,
  gistId,
  isLoading,
  isCommentsEnabled,
  isCommentSidebarOpen,
  setIsCommentSidebarOpen,
  selectedRevisionId,
  commentsCount,
  isReadOnly,
  isDailyNoteGist,
  revisions,
  gistCreatedAt,
  onSelectRevision,
  isRevisionsLoading,
  handleCopyGistUrl,
  handleCopyGistHtml,
  onToggleZenMode,
  onViewFullscreen,
  handleOpenInGithub,
  handleSaveWithForkCheck,
  hasUnsavedChanges,
  isSaving,
  setShowDeleteDialog,
}: DesktopToolbarProps) => (
  <>
    <ToggleGroup
      type="single"
      variant="outline"
      value={editorMode}
      onValueChange={(mode) => {
        if (mode) setEditorMode(mode as EditorMode);
      }}
      disabled={!gistId || isLoading}
    >
      {[
        { value: "edit", Icon: Pencil },
        { value: "split", Icon: Columns2 },
        { value: "preview", Icon: Eye },
      ].map(({ value, Icon }) => (
        <ToggleGroupItem
          size="sm"
          value={value}
          title={`${value.charAt(0).toUpperCase() + value.slice(1)} mode`}
        >
          <Icon className="h-3.5 w-3.5" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>

    {(isCommentsEnabled || !gistId) && (
      <Toggle
        pressed={isCommentSidebarOpen}
        onPressedChange={setIsCommentSidebarOpen}
        size="sm"
        disabled={!gistId || isLoading || !!selectedRevisionId}
        className="relative"
      >
        <MessageSquare className="h-4 w-4" />
        {commentsCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {commentsCount}
          </span>
        )}
      </Toggle>
    )}

    {((!isReadOnly && !isDailyNoteGist) || !gistId) && (
      <RevisionSelector
        revisions={revisions}
        selectedRevisionId={selectedRevisionId}
        onSelectRevision={onSelectRevision}
        gistCreatedAt={gistCreatedAt}
        isLoading={isRevisionsLoading}
      >
        <Toggle
          pressed={!!selectedRevisionId}
          size="sm"
          disabled={!gistId || isLoading}
          className="-mr-2 -ml-1"
        >
          <History className="h-4 w-4" />
        </Toggle>
      </RevisionSelector>
    )}

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!gistId || isLoading || !!selectedRevisionId}
          className="flex gap-0.5"
          title="GitHub options"
        >
          <ExternalLink className="h-4 w-4" />
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCopyGistUrl()}>
          <Link className="h-4 w-4 mr-2" />
          Copy URL
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyGistHtml} className="gap-2">
          <FileText className="h-4 w-4" />
          Copy as HTML
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleZenMode}>
          <Eye className="h-4 w-4 mr-2" />
          Enter Zen Mode
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onViewFullscreen?.()}>
          <Fullscreen className="h-4 w-4 mr-2" />
          View Fullscreen
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleOpenInGithub}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in GitHub
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Button
      onClick={handleSaveWithForkCheck}
      disabled={!gistId || !hasUnsavedChanges || isSaving || isLoading}
      className="gap-2"
    >
      <Save className="h-4 w-4" />
      Save
    </Button>

    {(!isReadOnly || !gistId) && (
      <Button
        variant="destructive"
        onClick={() => setShowDeleteDialog(true)}
        disabled={!gistId || isLoading}
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    )}
  </>
);

export default DesktopToolbar;
