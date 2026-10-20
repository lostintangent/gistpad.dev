import { baseExtensions, diff, diffExtension, dynamic, dynamicExtensions } from "./extensions";
import { findImage } from "./extensions/assets/image-upload";
import { darkTheme, lightTheme } from "./extensions/theme";
import { FormattingBubble, FormattingToolbar } from "./FormattingToolbar";
import { editorStatusAtom, editorViewAtom } from "./store";
import { usePreferences } from "@/features/account/queries";
import { showPendingAgentDiffsAtom } from "@/features/agent/model/store";
import { useIsAgentEnabled } from "@/features/agent/settings/modelSettings";
import { useCommentHighlights } from "@/features/comments/useCommentThreads";
import { readDraft, updateDraft, useDraft } from "@/features/files/draft";
import {
  focusRequestAtom,
  openFile,
  useActiveFile,
  useFileContent,
  useSaveFile,
} from "@/features/files/file";
import { getMarkdownFiles, toMarkdownFilename } from "@/shared/github";
import { useIsDarkMode, useIsMobile } from "@/shared/useMediaQuery";
import { redoDepth, undoDepth } from "@codemirror/commands";
import { getChunks, getOriginalDoc, originalDocChangeEffect } from "@codemirror/merge";
import { ChangeSet, EditorState, Transaction } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { useSelector } from "@tanstack/react-store";
import { ClipboardPaste, XCircle } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { toast } from "sonner";

/** The editor for the active file, which hosts CodeMirror (see `extensions`), and keeps it configured. */
export function EditorPane({
  revision,
  previewRef,
}: {
  /** The past revision that's being viewed (if any), which is shown read-only, with its changes. */
  revision: { version: string; content: string; previousContent: string } | null;
  /** The preview beside the editor (if it's shown), which scrolls along with it. */
  previewRef: RefObject<HTMLDivElement | null> | null;
}) {
  const file = useActiveFile();
  const preferences = usePreferences();
  const theme = useIsDarkMode() ? darkTheme : lightTheme;
  const isMobile = useIsMobile();
  const isAgentEnabled = useIsAgentEnabled();
  const draft = useDraft(file);
  const documentContent = useFileContent(file);
  const save = useSaveFile(file);
  const highlights = useCommentHighlights(file);
  const showPendingAgentDiffs = useSelector(showPendingAgentDiffsAtom);
  const view = useSelector(editorViewAtom);
  const focusRequest = useSelector(focusRequestAtom);
  const [dragOverlay, setDragOverlay] = useState<"image" | "unsupported" | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const isRevision = !!revision;
  const content = revision?.content ?? documentContent;
  const original = revision?.previousContent ?? file.savedContent;
  const showDiff =
    preferences.showDiffs || (!!draft?.hasPendingAgentEdit && showPendingAgentDiffs) || isRevision;
  const collapseUnchanged = !!draft?.hasPendingAgentEdit || isRevision;

  const extensions = dynamicExtensions({
    theme,
    preferences,
    gistId: file.gistId,
    otherFiles: getMarkdownFiles(file.gist).filter((name) => name !== file.filename),
    isAgentEnabled,
    highlights,
    isMobile,
    openWikilink: (link) => {
      const filename = toMarkdownFilename(link);
      if (file.gist?.files[filename]) openFile(file.gistId, filename);
      else toast.error(`No file named "${link}" exists in this gist`);
    },
  });

  const onUpdate = useEffectEvent((update: ViewUpdate) => {
    // The editor's own changes are the file's draft (the file's changes from elsewhere, e.g. the
    // agent's settings, are dispatched to the editor as remote; see below)
    if (update.docChanged && !update.transactions.some((tr) => tr.annotation(Transaction.remote))) {
      updateDraft(file, { content: update.state.doc.toString() });
    }

    if (update.selectionSet || update.docChanged) {
      const { from, to } = update.state.selection.main;
      editorStatusAtom.set({
        hasSelection: from !== to,
        canUndo: undoDepth(update.state) > 0,
        canRedo: redoDepth(update.state) > 0,
      });
    }

    // Once the user has accepted each of the agent's changes, then save them.
    const isAcceptingAgentEdit =
      readDraft(file)?.hasPendingAgentEdit &&
      update.transactions.some((tr) => tr.isUserEvent("accept"));

    if (isAcceptingAgentEdit && !getChunks(update.state)?.chunks.length) queueMicrotask(save);
  });

  // An editor is created for each file (or revision of it), from what's current at the time
  const createEditor = useEffectEvent(() => {
    editorStatusAtom.set({ hasSelection: false, canUndo: false, canRedo: false });

    return new EditorView({
      parent: parentRef.current!,
      doc: content,
      extensions: [
        baseExtensions,
        EditorState.readOnly.of(isRevision),
        EditorView.updateListener.of(onUpdate),
        dynamic.of(extensions),
        diff.of([]),
      ],
    });
  });

  // (Before the pane is painted, so that switching files doesn't flash an empty pane)
  useLayoutEffect(() => {
    const view = createEditor();
    editorViewAtom.set(view);

    return () => {
      view.destroy();
      editorViewAtom.set(null);
    };
  }, [file.key, revision?.version]);

  useEffect(() => {
    view?.dispatch({ effects: dynamic.reconfigure(extensions) });
  }, [view, extensions]);

  // The diff is its own compartment, since its state (which outlives reconfiguration) is only
  // initialized when it's added. Before painting, so a revision opens with its changes.
  useLayoutEffect(() => {
    if (!view) return;

    const extension = showDiff ? diffExtension({ original, isRevision, collapseUnchanged }) : [];
    view.dispatch({ effects: diff.reconfigure(extension) });
    if (!showDiff) return;

    // The original it was added with is kept, so it's updated once the file is saved
    const baseline = getOriginalDoc(view.state);
    if (baseline.toString() === original) return;

    const changes = ChangeSet.of(
      { from: 0, to: baseline.length, insert: original },
      baseline.length,
    );
    view.dispatch({ effects: originalDocChangeEffect(view.state, changes) });
  }, [view, showDiff, original, isRevision, collapseUnchanged]);

  // The editor follows the file's changes from elsewhere (its own are the draft; see `onUpdate`)
  useEffect(() => {
    if (!view || view.state.doc.toString() === content) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      annotations: Transaction.remote.of(true),
    });
  }, [view, content]);

  // Keep the preview scrolled to the same relative position as the editor.
  useEffect(() => {
    const preview = previewRef?.current;
    if (!view || !preview) return;

    const syncScroll = () => {
      const { scrollTop, clientHeight } = view.scrollDOM;
      const ratio = scrollTop / (view.contentHeight - clientHeight);
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    };

    view.scrollDOM.addEventListener("scroll", syncScroll);
    return () => view.scrollDOM.removeEventListener("scroll", syncScroll);
  }, [view, previewRef]);

  // Focus the editor when it's requested (e.g. for a new file), once the file's editor exists.
  const focusIfRequested = useEffectEvent(() => {
    if (!view || !focusRequest || focusRequest.gistId !== file.gistId) return;
    if (focusRequest.filename && focusRequest.filename !== file.filename) return;

    focusRequestAtom.set(null);
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.focus();
  });
  useEffect(() => focusIfRequested(), [view, focusRequest]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {preferences.showFormattingToolbar && <FormattingToolbar />}
      {/* (Dragged files are previewed over the editor, which handles their drop; see `imageUpload`) */}
      <div
        className="relative flex-1 min-h-0 p-2"
        onDragOver={(e) => {
          e.preventDefault();
          const hasFile = Array.from(e.dataTransfer.items).some((item) => item.kind === "file");
          setDragOverlay(
            isRevision || !hasFile
              ? null
              : findImage(e.dataTransfer.items)
                ? "image"
                : "unsupported",
          );
        }}
        onDragLeave={() => setDragOverlay(null)}
        onDrop={() => setDragOverlay(null)}
      >
        {dragOverlay && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <span className="flex items-center gap-2 text-base font-semibold">
              {dragOverlay === "image" ? (
                <>
                  <ClipboardPaste className="h-5 w-5" /> Paste image
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5" /> File type not supported
                </>
              )}
            </span>
          </div>
        )}
        <div ref={parentRef} className="h-full" />
      </div>
      <FormattingBubble />
    </div>
  );
}
