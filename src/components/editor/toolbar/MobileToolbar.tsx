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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Eye,
  ExternalLink,
  Fullscreen,
  History,
  Link,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";

interface MobileToolbarProps {
  isEditingDescription: boolean;
  isEditingFilename: boolean;
  isCommentSidebarOpen: boolean;
  setIsCommentSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPreviewMode: boolean;
  setEditorMode: (mode: EditorMode) => void;
  isCommentsEnabled?: boolean;
  commentsCount: number;
  selectedRevisionId?: string | null;
  gistId?: string;
  isLoading: boolean;
  setIsEditingDescription: React.Dispatch<React.SetStateAction<boolean>>;
  isReadOnly: boolean;
  revisions?: GistRevision[] | null;
  gistCreatedAt?: string;
  onSelectRevision?: (revisionId: string | null) => void;
  isRevisionsLoading: boolean;
  handleCopyGistUrl: (showToast?: boolean) => void;
  onViewFullscreen?: () => void;
  handleOpenInGithub: () => void;
  handleSaveWithForkCheck: () => Promise<void>;
  hasUnsavedChanges?: boolean;
  isSaving: boolean;
  setShowDeleteDialog: React.Dispatch<React.SetStateAction<boolean>>;
  isDeletingFile: boolean;
}

const MobileToolbar = ({
  isEditingDescription,
  isEditingFilename,
  isCommentSidebarOpen,
  setIsCommentSidebarOpen,
  isPreviewMode,
  setEditorMode,
  isCommentsEnabled,
  commentsCount,
  selectedRevisionId,
  gistId,
  isLoading,
  setIsEditingDescription,
  isReadOnly,
  revisions,
  gistCreatedAt,
  onSelectRevision,
  isRevisionsLoading,
  handleCopyGistUrl,
  onViewFullscreen,
  handleOpenInGithub,
  handleSaveWithForkCheck,
  hasUnsavedChanges,
  isSaving,
  setShowDeleteDialog,
  isDeletingFile,
}: MobileToolbarProps) => (
  <>
    {!isEditingDescription && !isEditingFilename && (
      <>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={
            isCommentSidebarOpen
              ? "comments"
              : isPreviewMode
              ? "preview"
              : "edit"
          }
          onValueChange={(value) => {
            if (!value) return;
            if (value === "comments") {
              setIsCommentSidebarOpen(true);
            } else {
              setIsCommentSidebarOpen(false);
              setEditorMode(value as EditorMode);
            }
          }}
          disabled={!gistId || isLoading}
          className="mr-1"
        >
          <ToggleGroupItem
            value="edit"
            aria-label="Editor mode"
            title="Show editor"
          >
            <Pencil className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="preview"
            aria-label="Preview mode"
            title="Show preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          {isCommentsEnabled && (
            <ToggleGroupItem
              value="comments"
              aria-label="Comments"
              disabled={!gistId || isLoading || !!selectedRevisionId}
              className="relative"
              title="Show comments"
            >
              <MessageSquare className="h-4 w-4" />
              {commentsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {commentsCount}
                </span>
              )}
            </ToggleGroupItem>
          )}
        </ToggleGroup>
      </>
    )}
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="sm"
          disabled={!gistId || isLoading}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isPreviewMode && !isCommentSidebarOpen && (
          <DropdownMenuItem
            onClick={() => setIsEditingDescription(true)}
            disabled={!gistId || isLoading || isReadOnly}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit description
          </DropdownMenuItem>
        )}
        <RevisionSelector
          revisions={revisions}
          gistCreatedAt={gistCreatedAt}
          selectedRevisionId={selectedRevisionId}
          onSelectRevision={onSelectRevision}
          isLoading={isRevisionsLoading}
          subMenu={true}
        >
          <History className="h-4 w-4 mr-2" />
          History
        </RevisionSelector>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!!selectedRevisionId}
          onClick={() => handleCopyGistUrl()}
        >
          <Link className="h-4 w-4 mr-2" />
          Copy URL
        </DropdownMenuItem>
        {onViewFullscreen && (
          <DropdownMenuItem
            disabled={!!selectedRevisionId}
            onClick={() => onViewFullscreen()}
          >
            <Fullscreen className="h-4 w-4 mr-2" />
            View Fullscreen
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={!!selectedRevisionId}
          onClick={handleOpenInGithub}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in GitHub
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSaveWithForkCheck}
          disabled={!gistId || !hasUnsavedChanges || isSaving || isLoading}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </DropdownMenuItem>
        {!isReadOnly && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTimeout(() => setShowDeleteDialog(true), 200)}
              disabled={!gistId || isLoading}
              className="text-red-500 focus:text-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeletingFile ? "Delete file" : "Delete gist"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  </>
);

export default MobileToolbar;
