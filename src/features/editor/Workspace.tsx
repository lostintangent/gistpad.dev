import CommentsPanel from "@/features/comments/CommentsPanel";
import { CommentTooltips } from "@/features/comments/CommentTooltips";
import { openComments } from "@/features/comments/store";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/resizable";
import { useDocument, useDocumentContent, useSaveDocument, type GistDocument } from "./document";
import { useEditorMode } from "./mode";
import { useIsMobile } from "@/shared/useMediaQuery";
import { CARD_CLASS } from "./card";
import { gistQueries } from "@/features/gists/queries";
import { useIsAiEnabled } from "@/features/ai/settings";
import { draftAtom, editorPanelSizeAtom, editorViewAtom, revisionAtom, zenModeAtom } from "./store";
import { commentsPanelOpenAtom, commentsPanelSizeAtom } from "@/features/comments/store";
import { undo, undoDepth } from "@codemirror/commands";
import type { EditorMode } from "@/router";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import {
  Activity,
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGroupRef } from "react-resizable-panels";
import ForkGistDialog from "./dialogs/ForkGistDialog";
import { EditorPane } from "./EditorPane";
import { RevisionBanner } from "./history/RevisionBanner";
import LoadingSkeleton from "./LoadingSkeleton";
import { PreviewPane } from "./PreviewPane";
import EditorToolbar from "./toolbar/EditorToolbar";

// AI features are only loaded for users who've configured AI
const AiAssistant = lazy(() => import("@/features/ai/AiAssistant"));

/** The content of a past revision of the document, and of the revision before it (to diff against). */
function useRevisionContent(doc: GistDocument, revisionId: string | null) {
  const { data: revisions = [] } = useQuery({
    ...gistQueries.revisions(doc.gistId ?? ""),
    enabled: !!revisionId,
  });

  const index = revisions.findIndex(({ version }) => version === revisionId);
  const previousRevisionId = index >= 0 ? revisions[index + 1]?.version : undefined;

  const revision = useQuery({
    ...gistQueries.revision(doc.gistId ?? "", revisionId ?? ""),
    enabled: !!revisionId,
    select: (gist) => gist.files[doc.filename]?.content ?? "",
  });

  const previousRevision = useQuery({
    ...gistQueries.revision(doc.gistId ?? "", previousRevisionId ?? ""),
    enabled: !!previousRevisionId,
    select: (gist) => gist.files[doc.filename]?.content ?? "",
  });

  if (!revisionId) return null;

  return {
    content: revision.data ?? "",
    previousContent: previousRevision.data ?? "",
    isLoading: revision.isPending || (!!previousRevisionId && previousRevision.isPending),
  };
}

/** Keyboard shortcuts that work anywhere in the editor (not just while CodeMirror is focused). */
function useWorkspaceShortcuts(onSave: () => void) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.defaultPrevented) return;

    if (event.key === "s" && draftAtom.get()) {
      event.preventDefault();
      onSave();
    } else if (event.key === "z" && !event.shiftKey) {
      // (Text inputs have their own undo history, e.g. the action bar or a comment)
      if (event.target instanceof Element && event.target.closest("input, textarea")) return;

      const view = editorViewAtom.get();
      if (view && undoDepth(view.state) > 0) {
        event.preventDefault();
        undo(view);
      }
    }
  });

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}

/** The sizes of the editor and preview panes (as percentages), for a view mode. */
function getPaneLayout(mode: EditorMode, editorSize: number) {
  const editor = mode === "edit" ? 100 : mode === "preview" ? 0 : editorSize;
  return { editor, preview: 100 - editor };
}

/**
 * Lays out the editor and preview, based on the view mode. Hidden panes are collapsed
 * (rather than unmounted), so that switching modes preserves their state.
 */
function DocumentPanes({ editor, preview }: { editor: ReactNode; preview: ReactNode }) {
  const [mode, setMode] = useEditorMode();
  const isMobile = useIsMobile();
  const groupRef = useGroupRef();

  const previewPane = (
    <Activity mode={mode === "edit" ? "hidden" : "visible"}>
      <div className="h-full">{preview}</div>
    </Activity>
  );

  useEffect(() => {
    groupRef.current?.setLayout(getPaneLayout(mode, editorPanelSizeAtom.get()));
  }, [groupRef, mode]);

  if (isMobile) {
    return (
      <div className="h-full">
        <div className={mode === "preview" ? "hidden" : "h-full"}>{editor}</div>
        {previewPane}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      groupRef={groupRef}
      defaultLayout={getPaneLayout(mode, editorPanelSizeAtom.get())}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        if (!isUserInteraction) return;

        // Dragging a pane closed switches to the mode that only shows the other one
        if (layout.editor === 0) setMode("preview");
        else if (layout.preview === 0) setMode("edit");
        else editorPanelSizeAtom.set(layout.editor);
      }}
    >
      <ResizablePanel id="editor" minSize="25" collapsible collapsedSize={0}>
        {editor}
      </ResizablePanel>
      <ResizableHandle className={mode === "split" ? "" : "hidden"} />
      <ResizablePanel id="preview" minSize="25" collapsible collapsedSize={0}>
        {previewPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default function Workspace() {
  const doc = useDocument();
  const content = useDocumentContent(doc);
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);
  const isAiEnabled = useIsAiEnabled();
  const isCommentsOpen = useSelector(commentsPanelOpenAtom);
  const revisionId = useSelector(revisionAtom);
  const revision = useRevisionContent(doc, revisionId);
  const save = useSaveDocument(doc);
  const { quotedThreads, isEnabled: isCommentsEnabled } = useCommentThreads(doc);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isForkDialogOpen, setIsForkDialogOpen] = useState(false);

  const saveOrFork = () => (doc.isReadOnly ? setIsForkDialogOpen(true) : save());

  useWorkspaceShortcuts(saveOrFork);

  // Comments are hidden while viewing a past revision
  const showComments = isCommentsEnabled && isCommentsOpen && !revisionId;

  // The action bar doesn't fit alongside the comments on mobile
  const showActionBar = isAiEnabled && !revisionId && !(isMobile && showComments);

  const aiAssistant = isAiEnabled && (
    <Suspense>
      <AiAssistant doc={doc} showActionBar={showActionBar} />
    </Suspense>
  );

  if (!doc.gistId) {
    return <div className={`${CARD_CLASS} w-full h-full relative`}>{aiAssistant}</div>;
  }

  const body = doc.error ? (
    <div className="h-full flex items-center justify-center text-muted-foreground italic">
      This gist couldn't be loaded
    </div>
  ) : doc.isLoading || revision?.isLoading ? (
    <LoadingSkeleton />
  ) : (
    <DocumentPanes
      editor={
        <EditorPane
          doc={doc}
          content={revision?.content ?? content}
          originalContent={revision?.previousContent ?? doc.savedContent}
          revisionId={revisionId}
          previewRef={previewRef}
        />
      }
      preview={
        <PreviewPane
          ref={previewRef}
          doc={doc}
          content={revision?.content ?? content}
          isViewingRevision={!!revisionId}
          showActionBar={showActionBar}
        />
      }
    />
  );

  const documentArea = (
    <div className="relative flex flex-col h-full min-h-0">
      {revision && <RevisionBanner doc={doc} content={revision.content} />}
      <div className="flex-1 min-h-0">{body}</div>
    </div>
  );

  return (
    <div className={`${CARD_CLASS} w-full h-full relative flex flex-col`}>
      {aiAssistant}
      {!isZenMode && <EditorToolbar key={doc.documentKey} doc={doc} onSave={saveOrFork} />}

      <div className="flex-1 min-h-0">
        {isMobile ? (
          <>
            {/* Hide (rather than unmount) the editor, so its state is preserved */}
            <div className={showComments ? "hidden" : "h-full"}>{documentArea}</div>
            {showComments && <CommentsPanel key={doc.documentKey} doc={doc} />}
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
                  <CommentsPanel key={doc.documentKey} doc={doc} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>

      <ForkGistDialog doc={doc} isOpen={isForkDialogOpen} onOpenChange={setIsForkDialogOpen} />
      <CommentTooltips
        threads={quotedThreads}
        onSelect={(commentId) => openComments({ commentId })}
      />
    </div>
  );
}
