import { createEditorCompletions } from "./code-mirror/completions";
import { assetUrlShortener } from "./code-mirror/decorations/asset-url-shortener";
import { clickableLinks } from "./code-mirror/decorations/clickable-links";
import { codeFenceMarker } from "./code-mirror/decorations/code-fence-marker";
import { commentQuotes } from "./code-mirror/decorations/comment-quotes";
import { mathEquationResult } from "./code-mirror/decorations/math-equations";
import { imagePreview } from "./code-mirror/hoverTooltips/image-preview";
import { emdash } from "./code-mirror/keybindings/emdash";
import { selectionFormatting } from "./code-mirror/keybindings/selection-formatting";
import { spellChecker } from "./code-mirror/linters/spell-checker";
import { selectionComment } from "./code-mirror/widgets/selection-comment";
import { useOpenDocument, useSaveOrFork, type GistDocument } from "./document";
import { useEditorMode } from "./mode";
import { useEditorThemes } from "./themes";
import { splitFrontMatter, withFrontMatter } from "@/shared/utils";
import { uploadImage } from "@/shared/supabase";
import { usePreferences } from "@/features/account/queries";
import { useIsAiEnabled } from "@/features/ai/settings";
import { showPendingAiDiffsAtom, updateAiState } from "@/features/ai/store";
import { commentsStore, openComments } from "@/features/comments/store";
import {
  draftAtom,
  editorStatusAtom,
  editorViewAtom,
  focusRequestAtom,
  updateDraft,
  useDraft,
} from "./store";
import { redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { getChunks, unifiedMergeView } from "@codemirror/merge";
import { EditorView, scrollPastEnd, type ViewUpdate } from "@codemirror/view";
import { useSelector } from "@tanstack/react-store";
import CodeMirror from "@uiw/react-codemirror";
import { ClipboardPaste, XCircle } from "lucide-react";
import { useEffect, useEffectEvent, useState, type RefObject } from "react";
import { toast } from "sonner";
import { FormattingToolbar } from "./FormattingToolbar";
import { useCommentThreads } from "@/features/comments/useCommentThreads";

const UPLOADING_PLACEHOLDER = "_Uploading image..._";

/** Inserts an image into the editor, after uploading it. */
async function insertImage(view: EditorView, gistId: string, file: File, asHtml: boolean) {
  const { from } = view.state.selection.main;
  const placeholder = { from, to: from + UPLOADING_PLACEHOLDER.length };
  view.dispatch({ changes: { from, insert: UPLOADING_PLACEHOLDER } });

  try {
    const url = await uploadImage(gistId, file);
    const markup = asHtml ? `<img src="${url}" />` : `![Image](${url})`;
    view.dispatch({ changes: { ...placeholder, insert: markup } });
  } catch {
    view.dispatch({ changes: { ...placeholder, insert: "" } });
    toast.error("Failed to upload image");
  }
}

const getImageFile = (items: DataTransferItemList) =>
  Array.from(items)
    .find((item) => item.kind === "file" && item.type.startsWith("image/"))
    ?.getAsFile();

export function EditorPane({
  doc,
  content,
  originalContent,
  revisionId,
  previewRef,
}: {
  doc: GistDocument;
  /** The content to display (which may be a past revision). */
  content: string;
  /** The content to diff against, when diffs are shown. */
  originalContent: string;
  revisionId: string | null;
  previewRef: RefObject<HTMLDivElement | null>;
}) {
  const preferences = usePreferences();
  const editorThemes = useEditorThemes();
  const isAiEnabled = useIsAiEnabled();
  const draft = useDraft(doc.documentKey);
  const saveOrFork = useSaveOrFork(doc);
  const openDocument = useOpenDocument();
  const { quotedThreads } = useCommentThreads(doc);
  const selectedCommentId = useSelector(commentsStore, (state) => state.selectedCommentId);
  const showPendingAiDiffs = useSelector(showPendingAiDiffsAtom);
  const view = useSelector(editorViewAtom);
  const isSplitMode = useEditorMode()[0] === "split";
  const focusRequest = useSelector(focusRequestAtom);
  const [dragOverlay, setDragOverlay] = useState<"image" | "unsupported" | null>(null);

  const isViewingRevision = revisionId !== null;
  const showDiff =
    preferences.showDiffs || (!!draft?.hasPendingAiEdit && showPendingAiDiffs) || isViewingRevision;

  // Frontmatter is hidden from the editor (unless the user opts to see it),
  // and restored whenever the visible content changes.
  const { content: body, frontMatterYaml } = splitFrontMatter(content);
  const getVisibleContent = (content: string) =>
    preferences.showFrontmatter ? content : splitFrontMatter(content).content;
  const restoreFrontmatter = (visibleContent: string) =>
    preferences.showFrontmatter ? visibleContent : withFrontMatter(visibleContent, frontMatterYaml);

  // Clear the published view, once this editor goes away.
  useEffect(() => () => editorViewAtom.set(null), []);

  // Keep the preview scrolled to the same relative position as the editor (in split mode).
  useEffect(() => {
    const preview = previewRef.current;
    if (!view || !preview || !isSplitMode) return;

    const syncScroll = () => {
      const { scrollTop, clientHeight } = view.scrollDOM;
      const ratio = scrollTop / (view.contentHeight - clientHeight);
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    };

    view.scrollDOM.addEventListener("scroll", syncScroll);
    return () => view.scrollDOM.removeEventListener("scroll", syncScroll);
  }, [view, previewRef, isSplitMode]);

  // Focus the editor when it's requested (e.g. for a new file), once the document's editor exists.
  const focusIfRequested = useEffectEvent(() => {
    if (!view || !focusRequest || focusRequest.gistId !== doc.gistId) return;
    if (focusRequest.filename && focusRequest.filename !== doc.filename) return;

    focusRequestAtom.set(null);
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.focus();
  });
  useEffect(() => focusIfRequested(), [view, focusRequest]);

  const onCreateEditor = (view: EditorView) => {
    editorViewAtom.set(view);
    editorStatusAtom.set({ hasSelection: false, canUndo: false, canRedo: false });
  };

  const onUpdate = (update: ViewUpdate) => {
    if (update.selectionSet || update.docChanged) {
      const { from, to } = update.state.selection.main;
      // (CodeMirror compacts its history, so query it rather than tracking it)
      const noop = { state: update.state, dispatch: () => {} };
      editorStatusAtom.set({ hasSelection: from !== to, canUndo: undo(noop), canRedo: redo(noop) });
    }

    // Once the user has accepted each of the AI's changes, then save them.
    const isAcceptingAiEdit =
      draftAtom.get()?.hasPendingAiEdit &&
      update.transactions.some((tr) => tr.isUserEvent("accept"));

    if (isAcceptingAiEdit && !getChunks(update.state)?.chunks.length) {
      queueMicrotask(async () => {
        await saveOrFork();
        updateAiState({ edit: null });
      });
    }
  };

  const openWikilink = (link: string) => {
    const filename = `${link}.md`;
    if (doc.gist?.files[filename]) openDocument(doc.gistId, filename);
    else toast.error(`No file named "${link}" exists in this gist`);
  };

  const otherFiles = Object.keys(doc.gist?.files ?? {}).filter((name) => name !== doc.filename);

  const extensions = [
    yamlFrontmatter({ content: markdown() }),
    markdown(),
    EditorView.lineWrapping,
    createEditorCompletions(otherFiles, isAiEnabled),
    assetUrlShortener,
    codeFenceMarker([
      { type: "tldraw", color: "purple" },
      { type: "toc", color: "blue" },
    ]),
    clickableLinks(openWikilink),
    imagePreview,
    emdash,
    selectionFormatting,
    preferences.isSpellcheckEnabled ? spellChecker : [],
    showDiff
      ? unifiedMergeView({
          original: getVisibleContent(originalContent),
          mergeControls: !isViewingRevision,
          collapseUnchanged: draft?.hasPendingAiEdit || isViewingRevision ? {} : undefined,
          allowInlineDiffs: true,
        })
      : [],
    commentQuotes(
      quotedThreads,
      selectedCommentId,
      preferences.showInlineComments && !isViewingRevision,
    ),
    selectionComment((text) => openComments({ quote: text })),
    mathEquationResult,
    scrollPastEnd(),
  ];

  return (
    <div className="grid grid-rows-[auto_1fr] p-2 h-full min-h-0">
      {preferences.showFormattingToolbar && <FormattingToolbar disabled={isViewingRevision} />}
      <div
        className="relative min-h-0"
        onDragOver={(e) => {
          e.preventDefault();
          const hasFile = Array.from(e.dataTransfer.items).some((item) => item.kind === "file");
          setDragOverlay(
            !hasFile ? null : getImageFile(e.dataTransfer.items) ? "image" : "unsupported",
          );
        }}
        onDragLeave={() => setDragOverlay(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverlay(null);
          const file = getImageFile(e.dataTransfer.items);
          if (file && view && doc.gistId)
            insertImage(view, doc.gistId, file, preferences.pasteImagesAsHtml);
        }}
        onPaste={(e) => {
          const file = getImageFile(e.clipboardData.items);
          if (!file || !view || !doc.gistId) return;

          e.preventDefault();
          insertImage(view, doc.gistId, file, preferences.pasteImagesAsHtml);
        }}
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
        <CodeMirror
          key={`${doc.documentKey}/${revisionId}`}
          value={preferences.showFrontmatter ? content : body}
          height="100%"
          className="h-full"
          theme={editorThemes[preferences.editorTheme as keyof typeof editorThemes]}
          basicSetup={{
            lineNumbers: preferences.showLineNumbers,
            foldGutter: preferences.showLineNumbers,
          }}
          readOnly={isViewingRevision}
          extensions={extensions}
          onChange={(value) =>
            updateDraft(doc.documentKey, doc.savedContent, { content: restoreFrontmatter(value) })
          }
          onUpdate={onUpdate}
          onCreateEditor={onCreateEditor}
        />
      </div>
    </div>
  );
}
