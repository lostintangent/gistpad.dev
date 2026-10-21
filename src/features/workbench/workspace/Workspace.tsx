import type { CommandPage } from "@/features/commands/palette";
import { openComments } from "@/features/comments/store";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/resizable";
import { useActiveFile, useSaveFile } from "@/features/files/file";
import { useEditorMode, type EditorMode } from "../layout/mode";
import { getPaneLayout } from "../layout/preferences";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useIsAgentRunning } from "@/features/agent/model/store";
import { useIsAgentEnabled } from "@/features/agent/settings/modelSettings";
import { editorPaneSizeAtom, zenModeAtom } from "../layout/state";
import { editorViewAtom } from "@/features/editor/store";
import { commentsPanelOpenAtom, commentsPanelSizeAtom } from "@/features/comments/store";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useSelector } from "@tanstack/react-store";
import { Activity, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useGroupRef } from "react-resizable-panels";
import ForkGistDialog from "./dialogs/ForkGistDialog";
import { RevisionBanner } from "./history/RevisionBanner";
import { useIsViewingRevision, useRevision } from "./history/revision";
import LoadingSkeleton from "@/shared/LoadingSkeleton";
import Toolbar from "./Toolbar";
import { ActionBar } from "../action-bar/ActionBar";
import { useWorkspaceCommands } from "./commands";
import { closeComments } from "@/features/comments/store";
import { useRouter } from "@tanstack/react-router";

// The workspace can render its chrome and the gist list while CodeMirror loads.
const loadEditorPane = () => import("@/features/editor/EditorPane");
const EditorPane = lazy(loadEditorPane);
const PreviewPane = lazy(() => import("./PreviewPane"));
const CommentsPanel = lazy(() => import("@/features/comments/CommentsPanel"));
const CommentTooltips = lazy(() => import("@/features/comments/CommentTooltips"));

/**
 * Lays out the editor and preview, based on the mode. Hidden panes are collapsed
 * (rather than unmounted), so that switching modes preserves their state.
 */
function Panes({ editor, preview }: { editor: ReactNode; preview: ReactNode }) {
  const isShell = useRouter().isShell();
  const [mode, setMode] = useEditorMode();
  const isMobile = useIsMobile();
  const editorSize = useSelector(editorPaneSizeAtom);
  const groupRef = useGroupRef();
  const [mountedPanes, setMountedPanes] = useState<EditorMode>(isShell ? "split" : mode);

  // Hidden Activity children still render, so don't mount a pane until it's first opened.
  // Once opened, keep it mounted to preserve its state when switching modes.
  if (mountedPanes !== "split" && mountedPanes !== mode) setMountedPanes("split");

  const previewPane = (
    <Activity mode={!isShell && mode === "edit" ? "hidden" : "visible"}>
      <div className="h-full">{mountedPanes !== "edit" && preview}</div>
    </Activity>
  );

  useEffect(() => {
    groupRef.current?.setLayout(getPaneLayout(mode, editorSize));
  }, [groupRef, mode, editorSize]);

  if (isMobile) {
    return (
      <div className="h-full">
        <div className={mode === "preview" ? "hidden" : "h-full"}>
          {mountedPanes !== "preview" && editor}
        </div>
        {previewPane}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      groupRef={groupRef}
      defaultLayout={isShell ? undefined : getPaneLayout(mode, editorSize)}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        if (!isUserInteraction) return;

        // Dragging a pane closed switches to the mode that only shows the other one
        if (layout.editor === 0) setMode("preview");
        else if (layout.preview === 0) setMode("edit");
        else editorPaneSizeAtom.set(layout.editor);
      }}
    >
      <ResizablePanel
        id="editor"
        defaultSize={isShell ? "var(--initial-editor-size, 50%)" : undefined}
        minSize="25"
        collapsible
        collapsedSize={0}
      >
        {mountedPanes !== "preview" && editor}
      </ResizablePanel>
      <ResizableHandle
        className={!isShell && mode !== "split" ? "hidden" : ""}
        style={isShell ? { display: "var(--initial-editor-divider, flex)" } : undefined}
      />
      <ResizablePanel
        id="preview"
        defaultSize={isShell ? "calc(100% - var(--initial-editor-size, 50%))" : undefined}
        minSize="25"
        collapsible
        collapsedSize={0}
      >
        {previewPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

const WORKSPACE_CLASS = "raised rounded-xl overflow-clip w-full h-full";

export default function Workspace({ commandPages }: { commandPages: readonly CommandPage[] }) {
  const file = useActiveFile();
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);
  const isAgentEnabled = useIsAgentEnabled();
  const isCommentsOpen = useSelector(commentsPanelOpenAtom);
  const revision = useRevision(file);
  const isViewingRevision = useIsViewingRevision();
  const [mode] = useEditorMode();
  const save = useSaveFile(file);
  const { quotedThreads, isEnabled: isCommentsEnabled } = useCommentThreads(file);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isForkDialogOpen, setIsForkDialogOpen] = useState(false);

  // Start the editor after the workspace commits, overlapping its download with gist data.
  useEffect(() => {
    if (file.gistId && mode !== "preview" && !file.error) loadEditorPane().catch(() => {});
  }, [file.gistId, mode, file.error]);

  // Saving someone else's gist forks it, so the user is asked first
  const requestSave = () => (file.isReadOnly ? setIsForkDialogOpen(true) : save());
  const commands = useWorkspaceCommands(file, requestSave);

  // Mod+Z undoes the editor's last change from anywhere in the workspace (while the editor, like
  // other text inputs, handles its own undo)
  useHotkey(
    "Mod+Z",
    async () => {
      if (!editorViewAtom.get()) return;
      const { undo, undoDepth } = await import("@codemirror/commands");
      const view = editorViewAtom.get();
      if (view && undoDepth(view.state) > 0) undo(view);
    },
    { ignoreInputs: true, enabled: !file.isLoading },
  );

  // Comments are hidden while viewing a past revision
  const showComments = isCommentsEnabled && isCommentsOpen && !revision;

  // The composer doesn't fit alongside the comments on mobile, so they close when the agent
  // starts (e.g. from the palette), to show it
  const showComposer = isAgentEnabled && !isViewingRevision && !(isMobile && showComments);
  const isAgentRunning = useIsAgentRunning();
  useEffect(() => {
    if (isMobile && isAgentRunning) closeComments();
  }, [isMobile, isAgentRunning]);

  const actionBar = (
    <ActionBar
      hasFile={!!file.gistId}
      isAgentVisible={showComposer}
      isAgentAvailable={!isViewingRevision && !file.error}
      showEdits={mode !== "preview"}
      pages={[...commandPages, ...commands.pages]}
    />
  );

  if (!file.gistId && !file.isLoading) {
    return <div className={`${WORKSPACE_CLASS} relative`}>{actionBar}</div>;
  }

  const isLoading = file.isLoading || revision?.isLoading;
  const skeleton = <LoadingSkeleton />;
  const body = file.error ? (
    <div className="h-full flex items-center justify-center text-muted-foreground italic">
      This gist couldn't be loaded
    </div>
  ) : (
    <Panes
      editor={
        <Suspense fallback={skeleton}>
          {/* (The preview scrolls with the editor while it's beside it) */}
          {isLoading ? (
            skeleton
          ) : (
            <EditorPane revision={revision} previewRef={mode === "split" ? previewRef : null} />
          )}
        </Suspense>
      }
      preview={
        <Suspense fallback={skeleton}>
          {isLoading ? skeleton : <PreviewPane ref={previewRef} revision={revision} />}
        </Suspense>
      }
    />
  );

  const documentArea = (
    <div className="relative flex flex-col h-full min-h-0">
      {revision && <RevisionBanner file={file} revision={revision} />}
      <div className="flex-1 min-h-0">{body}</div>
    </div>
  );
  const commentsPanel = (
    <Suspense fallback={skeleton}>
      <CommentsPanel key={file.key} file={file} />
    </Suspense>
  );

  return (
    <div className={`${WORKSPACE_CLASS} relative flex flex-col`}>
      {!file.isLoading && actionBar}
      <Toolbar key={file.key} file={file} hidden={isZenMode} commands={commands} />

      <div className="flex-1 min-h-0">
        {isMobile ? (
          <>
            {/* Hide (rather than unmount) the editor, so its state is preserved */}
            <div className={showComments ? "hidden" : "h-full"}>{documentArea}</div>
            {showComments && commentsPanel}
          </>
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            onLayoutChanged={(layout, { isUserInteraction }) => {
              if (isUserInteraction && layout.comments) commentsPanelSizeAtom.set(layout.comments);
            }}
          >
            <ResizablePanel id="document" minSize="25">
              {documentArea}
            </ResizablePanel>
            {showComments && (
              <>
                <ResizableHandle />
                <ResizablePanel
                  id="comments"
                  defaultSize={`${commentsPanelSizeAtom.get()}`}
                  minSize="18"
                >
                  {commentsPanel}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>

      <ForkGistDialog file={file} isOpen={isForkDialogOpen} onOpenChange={setIsForkDialogOpen} />
      {quotedThreads.length > 0 && (
        <Suspense>
          <CommentTooltips
            threads={quotedThreads}
            onSelect={(commentId) => openComments({ commentId })}
          />
        </Suspense>
      )}
    </div>
  );
}
