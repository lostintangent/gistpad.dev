import editContent from "@/agents/edit/edit";
import { AdditionalReference, AgentFollowUp } from "@/agents/openai";
import askContent from "@/agents/qa/ask";
import { ReviewComment, reviewContent } from "@/agents/qa/review";
import {
  editorModeAtom,
  isAiCommandInProgressAtom,
  selectedHeadingAtom,
} from "@/atoms";
import { useVoiceConversation } from "@/components/editor/ai/voice/useVoiceConversation";
import { createEditorCompletions } from "@/components/editor/code-mirror/completions";
import { assetUrlShortener } from "@/components/editor/code-mirror/decorations/asset-url-shortener";
import { clickableLinks } from "@/components/editor/code-mirror/decorations/clickable-links";
import { codeFenceMarker } from "@/components/editor/code-mirror/decorations/code-fence-marker";
import { commentQuotes } from "@/components/editor/code-mirror/decorations/comment-quotes";
import { imagePreview } from "@/components/editor/code-mirror/hoverTooltips/image-preview";
import { createEditorKeybindings } from "@/components/editor/code-mirror/keybindings";
import {
  lintTimeField,
  spellChecker,
} from "@/components/editor/code-mirror/linters/spell-checker";
import { selectionComment } from "@/components/editor/code-mirror/widgets/selection-comment";
import CommentsSidebar from "@/components/editor/comments/CommentsSidebar";
import AddFileDialog from "@/components/editor/dialogs/AddFileDialog";
import EditorToolbar from "@/components/editor/toolbar/EditorToolbar";
import { ScrollToTop } from "@/components/preview/ScrollToTop";
import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/useMobile";
import {
  fetchGistContent,
  forkGist,
  getDefaultFile,
  getGistComments,
  GistRevision,
  isDailyNote,
  isEmptyContent,
  type Gist,
  type GistComment,
} from "@/lib/github";
import { uploadImage } from "@/lib/supabase/client";
import {
  detectDateFormat,
  generateDateFilename,
  parseFrontMatter,
  playAiChime,
} from "@/lib/utils";
import { redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import {
  Chunk,
  getChunks,
  rejectChunk,
  unifiedMergeView,
} from "@codemirror/merge";
import { openSearchPanel } from "@codemirror/search";
import { Extension, Text } from "@codemirror/state";
import { EditorView, scrollPastEnd, ViewUpdate } from "@codemirror/view";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useAtom } from "jotai";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import DeleteGistDialog from "../dialogs/DeleteGistDialog";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import { ActionBar } from "./ai/ActionBar";
import ForkGistDialog from "./dialogs/ForkGistDialog";
import { FormattingToolbar } from "./FormattingToolbar";
import LoadingSkeleton from "./LoadingSkeleton";

import { tool } from "@openai/agents";
import { ClipboardPaste, XCircle } from "lucide-react";
import { stringify } from "yaml";
import { z } from "zod";
import { mathEquationResult } from "./code-mirror/decorations/math-equations";
import "./code-mirror/index.css";
import { RevisionBanner } from "./history/RevisionBanner";

export interface GistEditorRef {
  setCursorToEnd: () => void;
}

export interface GistEditorProps {
  content?: string;
  originalContent?: string;
  gistId?: string;
  gist?: Gist | null;
  onSave?: (gistId: string, content: string) => Promise<void>;
  onDelete?: () => void;
  description?: string;
  selectedFile?: string;
  onSelectFile?: (filename: string) => void;
  isLoading?: boolean;
  onCreateGist?: (
    description: string,
    content?: string,
    isPublic?: boolean,
    selectedTags?: string[]
  ) => void;
  onUpdateDescription?: (gistId: string, description: string) => Promise<void>;
  onRenameFile?: (oldFilename: string, newFilename: string) => Promise<void>;
  showDiff?: boolean;
  showFrontmatter?: boolean;
  showFormattingToolbar?: boolean;
  isAiEnabled?: boolean;
  onSaveAiSettings: (
    apiKey: string,
    askModel: string,
    reviewModel: string,
    editModel: string,
    researchModel: string,
    showReasoningSummaries: boolean
  ) => void;
  gists?: Gist[];
  hasUnsavedChanges?: boolean;
  onContentChange?: (content: string, saveImmediately?: boolean) => void;
  isReadOnly?: boolean;
  currentUser?: string | null;
  isStarred?: boolean;
  onStarToggle?: (gistId: string) => Promise<void>;
  selectedRevisionId?: string | null;
  onSelectRevision?: (revisionId: string | null) => void;
  onRestoreRevision?: () => void;
  editorTheme?: Extension;
  onAddFile?: (
    gistId: string,
    filename: string,
    content?: string
  ) => Promise<void>;
  showLineNumbers?: boolean;
  isSpellCheckEnabled?: boolean;
  pasteImagesAsHtml?: boolean;
  showInlineComments?: boolean;
  onViewFullscreen?: () => void;
  onHasPendingAiEdit: (value?: boolean) => void;
  onResearchTopic?: (
    request: string,
    content: string,
    userComments?: GistComment[]
  ) => void;
  revisions?: GistRevision[] | null;
  isRevisionsLoading: boolean;
  hasPendingAiEdit?: boolean;
  showPendingAiDiffs?: boolean;
  onTogglePendingAiDiffs?: () => void;
  getGlobalFrontMatter?: () => Record<string, any>;
  updateGlobalFrontMatter?: (frontMatter: Record<string, any>) => void;

  /** Whether zen mode is active */
  isZenMode?: boolean;
  /** Toggle zen mode */
  onToggleZenMode?: () => void;
  onSelectGist?: (gistId: string) => void;
  ref?: React.Ref<GistEditorRef>;
}

export default ({
  content = "",
  originalContent,
  gistId,
  gist,
  onSave,
  onDelete,
  description = "",
  selectedFile = "README.md",
  isLoading,
  onCreateGist,
  onUpdateDescription,
  showDiff = false,
  showFrontmatter = false,
  showFormattingToolbar = false,
  isAiEnabled = false,
  onSaveAiSettings,
  gists = [],
  hasUnsavedChanges = false,
  onContentChange,
  isReadOnly = false,
  currentUser = null,
  isStarred = false,
  onStarToggle,
  editorTheme,
  onAddFile,
  onSelectFile,
  onRenameFile,
  showLineNumbers = false,
  isSpellCheckEnabled = true,
  pasteImagesAsHtml = false,
  showInlineComments = true,
  onViewFullscreen,
  onHasPendingAiEdit,
  onResearchTopic,
  selectedRevisionId = null,
  onSelectRevision,
  onRestoreRevision,
  revisions = null,
  isRevisionsLoading = false,
  hasPendingAiEdit = false,
  showPendingAiDiffs = true,
  onTogglePendingAiDiffs,
  getGlobalFrontMatter,
  updateGlobalFrontMatter,
  isZenMode = false,
  onToggleZenMode,
  onSelectGist,
  ref,
}: GistEditorProps) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [aiReviewComments, setAiReviewComments] = useState<ReviewComment[]>(
    []
  );
  const [aiReviewFollowUp, setAiReviewFollowUp] =
    useState<AgentFollowUp | null>(null);
  const [appliedAiComments, setAppliedAiComments] = useState<number[]>([]);
  const [activeAiRequestRequest, setActiveAiReviewRequest] =
    useState<string>("");
  const [aiReviewTitle, setAiReviewTitle] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string>(null);
  const [showAiResponse, setShowAiResponse] = useState(false);
  const [aiResponses, setAiResponses] = useState<{
    edit?: string;
    review?: string;
    ask?: string;
  }>({});
  const [aiFollowUp, setAiFollowUp] = useState<AgentFollowUp | null>(null);
  const [reasoningSummary, setReasoningSummary] = useState<string | null>(
    null
  );
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [cancelAiCommand, setCancelAiCommand] = useState<
    (() => Promise<void>) | null
  >(null);
  const [reviewReasoningSummary, setReviewReasoningSummary] = useState<
    string | null
  >(null);
  const [selectedCommentsTab, setSelectedCommentsTab] = useState<
    "user" | "ai" | null
  >(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const [editorMode, setEditorMode] = useAtom(editorModeAtom);
  const isPreviewMode = editorMode === "preview";
  const isSplitMode = editorMode === "split";
  const isEditMode = !editorMode || editorMode === "edit";

  const isMobile = useIsMobile();
  const otherFiles = useMemo(
    () =>
      Object.keys(gist?.files || {})
        .filter((f) => f !== selectedFile)
        .map((f) => f.replace(/\.md$/, "")),
    [gist, selectedFile]
  );

  const [selectedHeading, setSelectedHeading] = useAtom(selectedHeadingAtom);

  // Update the URL and scroll position when the user
  // selects a heading link in the page.
  useEffect(() => {
    if (!selectedHeading) {
      searchParams.delete("heading");
    } else {
      searchParams.set("heading", selectedHeading);

      // Add a slight delay to allow the preview to render
      setTimeout(() => {
        const headingElement = previewRef.current?.querySelector(
          `[id="${selectedHeading}"]`
        ) as HTMLElement | null;
        if (headingElement) {
          headingElement.scrollIntoView();
          headingElement.setAttribute("tabindex", "-1");
          headingElement.focus();
          handleCopyGistUrl(false);
        }
      }, 200);
    }

    setSearchParams(searchParams);
  }, [selectedHeading, previewRef.current]);

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [newCommentValue, setNewCommentValue] = useState<string>("");
  const [isCommentSidebarOpen, setIsCommentSidebarOpen] = useState(false);
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<number | null>(
    null
  );

  const [editorPanelSize, setEditorPanelSize] = useState<number>(() => {
    const saved = localStorage.getItem("gistpad-editor-width");
    return saved ? parseFloat(saved) : 50;
  });

  useEffect(() => {
    localStorage.setItem("gistpad-editor-width", editorPanelSize.toString());
  }, [editorPanelSize]);

  const [commentPanelSize, setCommentPanelSize] = useState<number>(() => {
    const saved = localStorage.getItem("gistpad-comments-width");
    return saved ? parseFloat(saved) : 20;
  });

  useEffect(() => {
    localStorage.setItem(
      "gistpad-comments-width",
      commentPanelSize.toString()
    );
  }, [commentPanelSize]);

  const commentPanelRef = useRef<ImperativePanelHandle>(null);
  const editorPanelRef = useRef<ImperativePanelHandle>(null);
  const previewPanelRef = useRef<ImperativePanelHandle>(null);
  const [isCommentPanelDragging, setIsCommentPanelDragging] = useState(false);
  const [isEditorPanelDragging, setIsEditorPanelDragging] = useState(false);

  useEffect(() => {
    if (isMobile) return;

    if (isCommentSidebarOpen) {
      commentPanelRef.current?.expand();
    } else {
      commentPanelRef.current?.collapse();
    }
  }, [isCommentSidebarOpen, isMobile]);

  useEffect(() => {
    if (!isCommentSidebarOpen) {
      setSelectedCommentId(null);
      setNewCommentValue("");
      setSelectedCommentsTab(null);
    }
  }, [isCommentSidebarOpen]);

  useEffect(() => {
    if (isSplitMode) {
      editorPanelRef.current?.expand();
      previewPanelRef.current?.expand();
    } else if (isPreviewMode) {
      editorPanelRef.current?.collapse();
      previewPanelRef.current?.expand();
    } else {
      previewPanelRef.current?.collapse();
      editorPanelRef.current?.expand();
    }
  }, [isSplitMode, isPreviewMode]);

  const isDeletingFile =
    selectedFile !== "README.md" && Object.keys(gist?.files || {}).length > 1;

  // Only enable comments for non-daily notes
  const isCommentsEnabled = gist && !isDailyNote(gist);

  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ["gist-comments", gistId],
    queryFn: () => getGistComments(gistId!),
    enabled: !!gistId && isCommentsEnabled,
    staleTime: 1000 * 60 * 2, // 5 minutes
  });

  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [aiEditStats, setAiEditStats] = useState<{
    additions: number;
    deletions: number;
    hunks: number;
  } | null>(null);
  const [dragOverlayState, setDragOverlayState] = useState<
    "image" | "unsupported" | null
  >(null);

  // Listen for updates to the selection and also
  // track whether undo/redo is enabled after changes.
  function handleEditorUpdate(update: ViewUpdate) {
    if (update.selectionSet) {
      // selectionSet is true anytime the cursor or selection
      // changes (or when the editor receives focus). So we need
      // to check for it, and check if the "selection" is empty or not.
      const { from, to } = update.state.selection.main;
      setHasSelection(from !== to);
    }

    if (
      hasPendingAiEdit &&
      update.transactions.some((tr) => tr.isUserEvent("accept"))
    ) {
      const view = update.view;

      setTimeout(() => {
        const chunks = getChunks(view.state);
        if (!chunks || chunks.chunks.length === 0) {
          onHasPendingAiEdit(false);
          setAiEditStats(null);
          handleSave();
        }
      }, 100);
    }

    if (!update.docChanged) return;

    // I'd love to know if there's a better way of tracking
    // this state, but ATM, this is the best solution I could
    // find, since CM collapses the undo state over time, and
    // therefore, I can't track the undo stack myself.
    const isUndoAvailable = undo({
      state: update.view.state,
      dispatch: () => { },
    });
    setCanUndo(isUndoAvailable);

    const isRedoAvailable = redo({
      state: update.view.state,
      dispatch: () => { },
    });
    setCanRedo(isRedoAvailable);
  }

  // Synchronize the scroll position of the
  // editor and preview while in split mode.
  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view || !isSplitMode || !previewRef.current) return;

    const handleScroll = () => {
      if (!previewRef.current) return;

      const editorHeight = view.contentHeight;
      const previewHeight = previewRef.current.scrollHeight;

      const scrollRatio =
        view.scrollDOM.scrollTop /
        (editorHeight - view.scrollDOM.clientHeight);
      const previewScrollTop =
        scrollRatio * (previewHeight - previewRef.current.clientHeight);

      previewRef.current.scrollTop = previewScrollTop;
    };

    view.scrollDOM.addEventListener("scroll", handleScroll);
    return () => view.scrollDOM.removeEventListener("scroll", handleScroll);
  }, [isSplitMode, editorRef.current, previewRef.current]);

  const handleAddedComment = useCallback((text: string) => {
    const comment = `> ${text}\n\n`;
    setNewCommentValue(comment);
    setIsCommentSidebarOpen(true);
    setSelectedCommentsTab(null);
  }, []);

  // Check for a "quote" parameter in the URL and use it to add a comment
  useEffect(() => {
    const quoteParam = searchParams.get("quote");
    if (quoteParam && gistId) {
      // Use setTimeout to ensure this happens after initial render
      // when all components are properly initialized
      setTimeout(() => {
        handleAddedComment(decodeURIComponent(quoteParam));
        // Remove the quote parameter from URL after processing it
        searchParams.delete("quote");
        setSearchParams(searchParams);
      }, 100);
    }
  }, [searchParams, gistId, handleAddedComment, setSearchParams]);

  // Auto-close comments panel when selecting a revision
  useEffect(() => {
    if (selectedRevisionId) {
      setIsCommentSidebarOpen(false);
    }
  }, [selectedRevisionId]);

  // If the user selects a new gist or file:
  // 1. Reset editing states (description and filename)
  // 2. On mobile devices only: auto-close the comments sidebar for better UX
  // This helps prevent the comments panel from taking up the whole screen
  // when users are navigating between gists on smaller devices.
  useEffect(() => {
    setIsEditingDescription(false);
    setIsEditingFilename(false);
    setHasSelection(false);
    setCanRedo(false);
    setCanUndo(false);
    setAiReviewComments([]);
    setActiveAiReviewRequest("");
    setReviewReasoningSummary(null);
    setAiResponses({});

    // Auto-close comments panel on mobile when selecting a new gist
    if (isMobile && gistId) {
      setIsCommentSidebarOpen(false);
    }
  }, [selectedFile, gistId, isMobile]);

  const getDisplayContent = useCallback(
    (content: string) => {
      if (showFrontmatter) return content;
      const { content: contentWithoutFrontmatter } =
        parseFrontMatter(content);
      return contentWithoutFrontmatter;
    },
    [showFrontmatter]
  );

  const restoreFrontmatter = (newContent: string) => {
    if (showFrontmatter) return newContent;
    const { frontMatterYaml } = parseFrontMatter(content);
    if (!frontMatterYaml) return newContent;
    return `---\n${frontMatterYaml}\n---\n\n${newContent}`;
  };

  const handleChange = useCallback(
    (value: string) => {
      const valueToSave = restoreFrontmatter(value);
      onContentChange?.(valueToSave);
    },
    [onContentChange, restoreFrontmatter]
  );

  const handleSave = useCallback(async () => {
    if (!gistId || !hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      await onSave(gistId, content);

      // Clear any previous AI edit state
      // since we're treating the save gesture
      // as the end of the current edit session.
      onHasPendingAiEdit(false);
      setAiResponses((prev) => ({ ...prev, edit: undefined }));
      setAiEditStats(null);
    } finally {
      setIsSaving(false);
    }
  }, [gistId, onSave, content, hasUnsavedChanges]);

  const handleSaveWithForkCheck = useCallback(async () => {
    if (isReadOnly && gistId) {
      setShowForkDialog(true);
    } else {
      await handleSave();
    }
  }, [isReadOnly, gistId, handleSave]);

  // TODO: Move this logic into the index page
  const handleForkAndSave = async () => {
    if (!gistId) return;

    try {
      setShowForkDialog(false);

      const toastId = toast.loading("Forking gist...", { dismissible: false });

      const forkedGist = await forkGist(gistId);
      await onSave?.(forkedGist.id, content);

      toast.dismiss(toastId);
    } catch (error) {
      toast.error("Failed to fork and save gist");
    }
  };

  const handleDescriptionSave = async (newDescription: string) => {
    if (!gistId || !onUpdateDescription) return;
    setIsEditingDescription(false);
    await onUpdateDescription(gistId, newDescription);
  };

  // Add a CTRL+S handler for saving the selected gist
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      switch (e.key) {
        case "s": {
          if (gistId && hasUnsavedChanges && !isSaving && !isLoading) {
            e.preventDefault();
            handleSaveWithForkCheck();
          }
          break;
        }
        case "z": {
          if (canUndo) {
            e.preventDefault();
            undo(editorRef.current.view);
          }
          break;
        }
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    gistId,
    hasUnsavedChanges,
    isSaving,
    isLoading,
    editorRef,
    handleSaveWithForkCheck,
  ]);

  const [isAiCommandInProgress, setIsAiCommandInProgress] = useAtom(
    isAiCommandInProgressAtom
  );
  const [isAiReviewInProgress, setIsAiReviewInProgress] = useState(false);
  const [isAiEditInProgress, setIsAiEditInProgress] = useState(false);
  const [aiCommentBeingApplied, setAiCommentBeingApplied] = useState<
    number | null
  >(null);

  const {
    startVoiceConversation,
    endVoiceConversation,
    isVoiceActive,
    muteMicrophone,
    isMicMuted,
    whoIsSpeaking,
    sendVoiceCommand,
  } = useVoiceConversation({
    gistId,
    selectedFile,
    content,
    description,
    onEditContent: (request) => performAiEdit(request),
    isLoading,
    gist,
    onSelectFile,
    onAddFile,
    onCreateGist,
    isMobile,
    handleSaveWithForkCheck,
    setIsAiCommandInProgress,
    isReadOnly,
    setShowDeleteDialog: () => setShowDeleteDialog(true),
    setCommentSidebarOpen: setIsCommentSidebarOpen,
    getGlobalFrontMatter,
    onResearchTopic,
    onReviewContent: (topic) => performAiReview(topic),
  });

  const getFrontmatter = useCallback(() => {
    const { frontMatter } = parseFrontMatter(content);
    return frontMatter;
  }, [content]);

  const updateFrontmatter = useCallback(
    (newFrontMatter: Record<string, any>) => {
      const { content: contentWithoutFrontmatter } =
        parseFrontMatter(content);

      const frontmatterYaml =
        Object.keys(newFrontMatter).length > 0
          ? stringify(newFrontMatter)
          : "";
      const frontMatter = frontmatterYaml
        ? `---\n${frontmatterYaml}---\n\n`
        : "";
      const updatedContent = `${frontMatter}${contentWithoutFrontmatter}`;

      // If the user doesn't currently have any unsaved changes
      // then let's save the content immediately.
      onContentChange?.(updatedContent, !hasUnsavedChanges);
    },
    [content, onContentChange, hasUnsavedChanges]
  );

  const handleCopyGistUrl = (showToast = true) => {
    navigator.clipboard.writeText(window.location.href);
    if (showToast) {
      toast.success("URL copied to clipboard!");
    }
  };

  const handleCopyGistHtml = async () => {
    const { markdownToHtml } = await import("@/lib/markdown");
    await markdownToHtml(content);
    toast.success("HTML copied to clipboard!");
  };

  const handleOpenInGithub = () => {
    if (!gistId) return;
    let url = `https://gist.github.com/${gistId}`;
    if (selectedFile !== "README.md") {
      url += `#file-${selectedFile.replace(/\./g, "-")}`;
    }
    window.open(url, "_blank");
  };

  const insertImageFile = async (gistId: string, file: File) => {
    try {
      const view = editorRef.current?.view;
      if (view) {
        const { from } = view.state.selection.main;
        // Insert placeholder text
        view.dispatch({
          changes: { from, insert: "_Uploading image..._" },
        });

        const imageUrl = await uploadImage(gistId, file);
        const imageMarkup = pasteImagesAsHtml
          ? `<img src="${imageUrl}" />`
          : `![Image](${imageUrl})`;

        // Replace placeholder with image markup
        view.dispatch({
          changes: {
            from,
            to: from + "_Uploading image..._".length,
            insert: imageMarkup,
          },
        });
      }
    } catch (error) {
      // If there was an error, remove the placeholder text
      const view = editorRef.current?.view;
      if (view) {
        const { from } = view.state.selection.main;
        view.dispatch({
          changes: {
            from,
            to: from + "_Uploading image..._".length,
            insert: "",
          },
        });
      }

      toast.error("Failed to upload image");
    }
  };

  const handlePaste = async (
    gistId: string,
    e: React.ClipboardEvent<HTMLDivElement>
  ) => {
    if (!e.clipboardData) return;

    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    e.preventDefault();

    const file = imageItem.getAsFile();
    if (!file) return;

    await insertImageFile(gistId, file);
  };

  const handleDrop = async (
    gistId: string,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();

    const items = Array.from(e.dataTransfer.items);
    const imageItem = items.find(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    await insertImageFile(gistId, file);
  };

  const handleDragOverEditor = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items);
    const imageItem = items.find(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );
    const hasFile = items.some((item) => item.kind === "file");
    if (!hasFile) {
      setDragOverlayState(null);
      return;
    }

    setDragOverlayState(imageItem ? "image" : "unsupported");
  };

  const handleDragLeaveEditor = () => {
    setDragOverlayState(null);
  };

  useImperativeHandle(
    ref,
    () => ({
      setCursorToEnd: () => {
        if (editorRef.current?.view) {
          const view = editorRef.current.view;
          const lastLine = view.state.doc.lines;
          const lastLinePos = view.state.doc.line(lastLine).to;
          view.dispatch({
            selection: { anchor: lastLinePos, head: lastLinePos },
          });
          view.focus();
        }
      },
    }),
    []
  );

  const computeDiffStats = useCallback((orig: string, updated: string) => {
    const a = Text.of(orig.split(/\r?\n/));
    const b = Text.of(updated.split(/\r?\n/));
    const chunks = Chunk.build(a, b);
    const countLines = (t: Text, from: number, to: number) =>
      from === to ? 0 : t.lineAt(to - 1).number - t.lineAt(from).number + 1;
    let additions = 0;
    let deletions = 0;
    for (const ch of chunks) {
      additions += countLines(b, ch.fromB, ch.toB);
      deletions += countLines(a, ch.fromA, ch.toA);
    }
    return { additions, deletions, hunks: chunks.length };
  }, []);

  const handleAiCommand = useCallback(
    async (
      command: string | null,
      mode: string,
      args?: { isRegen: boolean; input?: string }
    ) => {
      // Research commands are async, so we don't need
      // to treat them as being in-progress like other commands.
      if (mode !== "research") {
        setIsAiCommandInProgress(true);
      }

      setCancelAiCommand(null);

      const view = editorRef.current?.view;
      const additionalReferences: AdditionalReference[] = [];

      if (command) {
        const gistRefRegex = /@\[([^\]]+)\]/g;
        let match: RegExpExecArray | null;
        while ((match = gistRefRegex.exec(command))) {
          const title = match[1];
          const referenced = gists.find((g) => g.description === title);
          if (referenced) {
            try {
              const defaultFile = getDefaultFile(referenced);
              const content = await fetchGistContent(
                referenced.id,
                defaultFile
              );
              additionalReferences.push({ title, content });
            } catch { }
          }
        }

        const fileRefRegex = /#\[([^\]]+)\]/g;
        while ((match = fileRefRegex.exec(command))) {
          const title = match[1];
          if (gistId) {
            try {
              const content = await fetchGistContent(gistId, `${title}.md`);
              additionalReferences.push({ title, content });
            } catch { }
          }
        }

        // Replace gist and file references with just the title
        command = command.replace(/[@#]\[([^\]]+)\]/g, '"$1"');
      }

      const getInstructions = () => {
        const frontMatter = getFrontmatter() || {};
        const globalFrontMatter = getGlobalFrontMatter?.() || {};
        const instructions: string[] = [];

        if (globalFrontMatter.general?.instructions) {
          instructions.push(globalFrontMatter.general.instructions);
        }

        if (frontMatter.general?.instructions) {
          instructions.push(frontMatter.general.instructions);
        }

        const overridesGlobalSettings =
          mode === "edit"
            ? frontMatter.edit?.overridesGlobalSettings === true
            : frontMatter.discuss?.overridesGlobalSettings === true;

        if (!overridesGlobalSettings) {
          if (mode === "edit" && globalFrontMatter.edit?.instructions) {
            instructions.push(globalFrontMatter.edit.instructions);
          } else if (
            (mode === "discuss" || mode === "ask") &&
            globalFrontMatter.discuss?.instructions
          ) {
            instructions.push(globalFrontMatter.discuss.instructions);
          }
        }

        if (mode === "edit" && frontMatter.edit?.instructions) {
          instructions.push(frontMatter.edit.instructions);
        } else if (
          (mode === "discuss" || mode === "ask") &&
          frontMatter.discuss?.instructions
        ) {
          instructions.push(frontMatter.discuss.instructions);
        }

        return instructions.length > 0
          ? instructions.join("\n\n---\n\n")
          : undefined;
      };

      const getCommandContext = () => {
        const selection = view?.state.selection.main;
        const selectionContent = view?.state.sliceDoc(
          selection.from,
          selection.to
        );

        const hasSelection =
          view &&
          selection.from !== selection.to &&
          selectionContent?.trim().length > 0;
        const commandContent = hasSelection
          ? selectionContent
          : parseFrontMatter(content).content;
        const editRange = hasSelection
          ? { from: selection.from, to: selection.to }
          : { from: 0, to: view?.state.doc.length || 0 };

        return {
          commandContent,
          applyChange: (updatedContent: string) => {
            // TODO: Clean up the frontmatter parsing logic
            // to avoid duplicating this code in multiple places.
            if (showFrontmatter && !hasSelection) {
              const { frontMatterYaml } = parseFrontMatter(content);
              if (frontMatterYaml) {
                updatedContent = `---\n${frontMatterYaml}\n---\n\n${updatedContent}`;
              }
            }

            if (view) {
              view.dispatch(
                view.state.update({
                  changes: {
                    from: editRange.from,
                    to: editRange.to,
                    insert: updatedContent,
                  },
                  userEvent: "ai",
                })
              );
            } else {
              handleChange(updatedContent);
            }
          },
        };
      };

      const extraTools = [
        tool({
          name: "list_gists",
          description:
            "List all of the user's gists (documents/notes), which may provide relevant context to the current conversation",
          parameters: z.object({}),
          execute: () => {
            return gists.map((g) => ({
              name: g.description,
              id: g.id,
            }));
          },
        }),
        tool({
          name: "read_gist",
          description:
            "Read the contents of a gist, which may provide relevant context to the current conversation",
          parameters: z.object({
            gistId: z.string(),
          }),
          execute: async ({ gistId }) => {
            const defaultFile = getDefaultFile(
              gists.find((g) => g.id === gistId)
            );
            return await fetchGistContent(gistId, defaultFile);
          },
        }),
      ];

      const abortController = new AbortController();

      if (mode === "talk" && isVoiceActive) {
        sendVoiceCommand(command);
      } else if (mode === "edit") {
        try {
          setIsAiEditInProgress(true);

          // If the user has any unsaved manual edits, then
          // save them, so that the diff can be entirely
          // focused on AI edits. But we don't want to auto-save
          // when there are pending AI edits, becuase the user
          // might still be steering them and doesn't want interim saves.
          if (!hasPendingAiEdit && hasUnsavedChanges) {
            await handleSaveWithForkCheck();
          }

          let { commandContent, applyChange } = getCommandContext();
          const isInitialContentEmpty = isEmptyContent(commandContent);
          if (isInitialContentEmpty) {
            commandContent = "";
          }

          let updatedContent = commandContent;

          setCancelAiCommand(() => async () => {
            abortController.abort();

            // If any changes were made, then restore the original content
            if (updatedContent !== commandContent) {
              applyChange(commandContent);
            }

            setIsAiEditInProgress(false);
          });

          const responseId = await editContent(
            commandContent,
            command,
            description,
            getInstructions(),
            additionalReferences,
            (patchedContent) => {
              updatedContent = patchedContent;
              if (updatedContent !== commandContent) {
                if (!isInitialContentEmpty) {
                  onHasPendingAiEdit(true);
                }
                applyChange(updatedContent);

                if (view) {
                  const stats = computeDiffStats(
                    getDisplayContent(originalContent || ""),
                    getDisplayContent(updatedContent || "")
                  );
                  setAiEditStats(stats);
                }
              }
            },
            abortController.signal,
            aiResponses.edit
          );

          setAiResponses((prev) => ({ ...prev, edit: responseId }));
          playAiChime();
        } catch (e) {
          if (!abortController.signal.aborted) {
            console.error("Failed to edit file:", e);
          }
        } finally {
          setIsAiCommandInProgress(false);
          setIsAiEditInProgress(false);
          setCancelAiCommand(null);
        }
      } else if (mode === "discuss") {
        try {
          const { commandContent } = getCommandContext();

          setIsAiReviewInProgress(true);
          setAiReviewComments([]);
          setAppliedAiComments([]);
          setReviewReasoningSummary(null);
          setIsCommentSidebarOpen(true);
          setSelectedCommentsTab("ai");

          if (args?.isRegen) {
            command =
              "Please generate a new set of comments based on the same request as the previous review";

            if (args?.input) {
              command += `, and also consider this additional context: "${args.input}"`;
            }
            setAiReviewTitle(null);
          } else {
            setActiveAiReviewRequest(command);
            setAiReviewTitle(null);
          }

          setCancelAiCommand(() => async () => {
            abortController.abort();

            setCancelAiCommand(null);
            setIsAiCommandInProgress(false);
            setIsAiReviewInProgress(false);
            setReviewReasoningSummary(null);
            setAiReviewComments([]);
            setAiReviewTitle(null);
            setIsCommentSidebarOpen(false);
          });

          const userCommentsForReview = !hasSelection ? comments : undefined;

          const responseId = await reviewContent(
            commandContent,
            command,
            description,
            getInstructions(),
            userCommentsForReview && userCommentsForReview.length > 0
              ? userCommentsForReview
              : undefined,
            additionalReferences,
            setAiReviewComments,
            setAiReviewFollowUp,
            setAiReviewTitle,
            setReviewReasoningSummary,
            setIsWebSearching,
            aiResponses.review,
            abortController.signal,
            extraTools
          );

          setAiResponses((prev) => ({ ...prev, review: responseId }));
          playAiChime();
        } catch (error) {
          console.error("Failed to review content:", error);
        } finally {
          setIsAiCommandInProgress(false);
          setIsAiReviewInProgress(false);
          setCancelAiCommand(null);
        }
      } else if (mode === "ask") {
        try {
          // Reset the ask response state
          setShowAiResponse(true);
          setAiResponse("");
          setAiFollowUp(null);
          setReasoningSummary(null);

          setCancelAiCommand(() => async () => {
            // Cancel the response and then
            // clear the ask state
            abortController.abort();
            setShowAiResponse(false);
            setAiResponse(null);
            setAiFollowUp(null);
          });

          const { commandContent } = getCommandContext();
          const responseId = await askContent(
            commandContent,
            command,
            description,
            getInstructions(),
            additionalReferences,
            setAiResponse,
            setAiFollowUp,
            setReasoningSummary,
            setIsWebSearching,
            aiResponses.ask,
            abortController.signal,
            extraTools
          );

          setAiResponses((prev) => ({ ...prev, ask: responseId }));
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error("Failed to answer question:", error);
          }
        } finally {
          setIsAiCommandInProgress(false);
          setCancelAiCommand(null);
          setReasoningSummary(null);
        }
      } else if (mode === "research") {
        const { commandContent } = getCommandContext();
        const userCommentsForResearch = !hasSelection ? comments : undefined;

        onResearchTopic?.(
          command,
          commandContent,
          userCommentsForResearch && userCommentsForResearch.length > 0
            ? userCommentsForResearch
            : undefined
        );
      }
    },
    [
      content,
      isVoiceActive,
      sendVoiceCommand,
      editorRef,
      description,
      showFrontmatter,
      onHasPendingAiEdit,
      aiReviewComments,
      activeAiRequestRequest,
      comments,
      hasSelection,
      handleSaveWithForkCheck,
      getFrontmatter,
      getGlobalFrontMatter,
      aiResponses,
      gistId,
      gists,
    ]
  );

  var performAiReview = useCallback(
    (topic: string) => handleAiCommand(topic, "discuss"),
    [handleAiCommand]
  );

  var performAiEdit = useCallback(
    (topic: string) => handleAiCommand(topic, "edit"),
    [handleAiCommand]
  );

  const regenerateAiDiscussion = useCallback(
    (input?: string) =>
      handleAiCommand(null, "discuss", { isRegen: true, input }),
    [handleAiCommand]
  );

  const acceptAiComment = async (comment: ReviewComment, input?: string) => {
    setAiCommentBeingApplied(comment.id);

    const applyFeedbackCommand = `Make the following change to the document: ${comment.applyPrompt}

The following provides some additional context about the change that I'd like to make: 
${JSON.stringify({ feedback: comment.comment, referenced_text: comment.referencedText || undefined, replace_with: comment.replaceWith || undefined, insert_after: comment.insertAfter || undefined }, null, 2)}

${input ? `Additionally, here's some extra clarification about how I'd like this change made: "${input}"` : ""}

It's important that you don't simply add the comment text to the document, but rather that you take the time to think about how to best update the document based on your comment (e.g. inserting an item into a list, moving content around, updating a sentence, etc.). Additionally, don't add a commment into the document about the change, simply make the change.`;

    await handleAiCommand(applyFeedbackCommand, "edit");

    setAppliedAiComments((prev) => [...prev, comment.id]);
    setAiCommentBeingApplied(null);

    if (isMobile) {
      setIsCommentSidebarOpen(false);
    }
  };

  const handleAddFile = async (filename: string) => {
    if (!gistId || !onAddFile) return;
    await onAddFile(gistId, filename);
    setShowAddFileDialog(false);
  };

  const fileCount = gistId && gist ? Object.keys(gist.files).length : 0;
  const filteredFiles = gistId
    ? Object.keys(gist?.files || {}).filter((filename) =>
      filename.endsWith(".md")
    )
    : [];
  const dateFormat = detectDateFormat(filteredFiles);
  const suggestedFilename = dateFormat
    ? generateDateFilename(dateFormat, new Date())
    : "";
  const isDailyNoteGist = gist && isDailyNote(gist);

  // TODO: move this logic into the clickable link plugin
  useEffect(() => {
    const handleWikilinkClick = (e: CustomEvent) => {
      const link = e.detail.link;
      const targetFilename = `${link}.md`;
      if (gist?.files[targetFilename]) {
        onSelectFile?.(targetFilename);
      } else {
        toast.error(`No file named "${link}" exists in this gist`);
      }
    };

    window.addEventListener(
      "wikilink-click",
      handleWikilinkClick as EventListener
    );
    return () =>
      window.removeEventListener(
        "wikilink-click",
        handleWikilinkClick as EventListener
      );
  }, [gist, onSelectFile, toast]);

  const handleTaskListItemChange = useCallback(
    (itemText: string) => {
      // First find the task list item in the content to determine its current state
      const regex = new RegExp(
        `^(\\s*[-+*]\\s+\\[)([\\sxX])(\\]\\s*${itemText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})$`,
        "gm"
      );
      const match = regex.exec(content);

      if (match) {
        // If we found a match, toggle the state - if it has an x or X, remove it, otherwise add x
        const isCurrentlyChecked = match[2].trim().toLowerCase() === "x";
        const updatedContent = content.replace(
          regex,
          `$1${isCurrentlyChecked ? " " : "x"}$3`
        );
        handleChange(updatedContent);
      }
    },
    [content, handleChange]
  );

  const editorHeight = selectedRevisionId
    ? showFormattingToolbar
      ? "calc(100vh - 14.6rem)"
      : "calc(100vh - 12rem)"
    : showFormattingToolbar
      ? isSplitMode
        ? `calc(100vh - ${isZenMode ? "8.2rem" : "12rem"})`
        : "calc(100vh - 12rem)"
      : isSplitMode
        ? `calc(100vh - ${isZenMode ? "5.6rem" : "9.4rem"})`
        : "calc(100vh - 9.4rem)";

  const formattingToolbar = showFormattingToolbar && (
    <FormattingToolbar
      editor={editorRef}
      hasSelection={hasSelection}
      addNewComment={handleAddedComment}
      canUndo={canUndo}
      canRedo={canRedo}
      onSearchInFile={() => openSearchPanel(editorRef.current.view)}
      disabled={!!selectedRevisionId}
    />
  );

  const editorPanel = (
    <div className="grid grid-rows-[auto_1fr] p-2">
      {formattingToolbar}
      <div className="relative">
        {dragOverlayState && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <span className="flex items-center gap-2 text-base font-semibold">
              {dragOverlayState === "image" ? (
                <ClipboardPaste className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {dragOverlayState === "image"
                ? "Paste image"
                : "File type not supported"}
            </span>
          </div>
        )}
        <CodeMirror
          key={`editor-${gistId}-${selectedFile}`}
          ref={editorRef}
          value={getDisplayContent(content)}
          height={editorHeight}
          theme={editorTheme}
          basicSetup={{
            lineNumbers: showLineNumbers,
            foldGutter: showLineNumbers,
          }}
          readOnly={!!selectedRevisionId}
          extensions={[
            yamlFrontmatter({ content: markdown() }),
            markdown(),
            EditorView.lineWrapping,
            createEditorCompletions(
              Object.keys(gist?.files || {}).filter(
                (filename) => filename !== selectedFile
              ),
              isAiEnabled
            ),
            assetUrlShortener(),
            codeFenceMarker([
              { type: "tldraw", color: "purple" },
              { type: "toc", color: "blue" },
            ]),
            clickableLinks(),
            imagePreview(),
            createEditorKeybindings(),
            isSpellCheckEnabled && spellChecker,
            isSpellCheckEnabled && lintTimeField,
            showDiff &&
            unifiedMergeView({
              original: getDisplayContent(originalContent),
              mergeControls: !selectedRevisionId,
              collapseUnchanged:
                (hasUnsavedChanges && hasPendingAiEdit) ||
                  !!selectedRevisionId
                  ? {}
                  : undefined,
              allowInlineDiffs: true,
            }),
            commentQuotes(
              comments,
              (commentId) => {
                setIsCommentSidebarOpen(true);
                setSelectedCommentId(commentId);
                setSelectedCommentsTab(null);
              },
              selectedCommentId,
              showInlineComments && !selectedRevisionId
            ),
            selectionComment(handleAddedComment),
            mathEquationResult(),
            scrollPastEnd(),
          ].filter(Boolean)}
          onChange={handleChange}
          onUpdate={handleEditorUpdate}
          onPaste={(e) => handlePaste(gistId, e)}
          onDrop={(e) => {
            handleDrop(gistId, e);
            setDragOverlayState(null);
          }}
          onDragOver={handleDragOverEditor}
          onDragLeave={handleDragLeaveEditor}
        />
      </div>
    </div>
  );

  const previewPanel = (
    <div
      ref={previewRef}
      className="overflow-y-auto p-4 h-full"
    >
      <MarkdownPreview
        onSelectFile={onSelectFile}
        onSelectHeading={setSelectedHeading}
        contentContainerRef={previewRef}
        onAddComment={handleAddedComment}
        isReadonly={isReadOnly || !!selectedRevisionId}
        scrollPastTheEnd={isAiEnabled}
        showInlineComments={showInlineComments && !selectedRevisionId}
        comments={comments}
        selectedCommentId={selectedCommentId}
        setSelectedComment={(commentId) => {
          setIsCommentSidebarOpen(true);
          setSelectedCommentId(commentId);
          setSelectedCommentsTab(null);
        }}
        onToggleTaskListItem={handleTaskListItemChange}
        gists={gists}
        onSelectGist={onSelectGist}
      >
        {content}
      </MarkdownPreview>
      {!isEditMode && (
        <ScrollToTop
          containerRef={previewRef}
          isActionBarVisible={!selectedRevisionId}
        />
      )}
    </div>
  );

  const editorBody = !gistId ? (
    <div className="p-2 h-full w-full flex items-center justify-center">
      <div className="text-muted-foreground text-md italic">
        {isLoading && "Loading your gists..."}
      </div>
    </div>
  ) : isLoading && !isSaving ? (
    <LoadingSkeleton leftWidth={editorPanelSize} />
  ) : (
    <ResizablePanelGroup
      direction="horizontal"
      onLayout={(sizes) => setEditorPanelSize(sizes[0])}
    >
      <ResizablePanel
        ref={editorPanelRef}
        defaultSize={editorPanelSize}
        minSize={25}
        collapsible
        onCollapse={() => setEditorMode("preview")}
        className={`${isMobile && isPreviewMode ? "hidden" : ""} ${isEditorPanelDragging || isMobile ? "" : "transition-[flex-grow] duration-200 ease-in-out"}`}
      >
        {editorPanel}
      </ResizablePanel>
      <ResizableHandle
        className={isSplitMode ? "" : "hidden"}
        onDragging={setIsEditorPanelDragging}
      />
      <ResizablePanel
        ref={previewPanelRef}
        defaultSize={100 - editorPanelSize}
        minSize={25}
        collapsible
        onCollapse={() => setEditorMode("edit")}
        className={`${isMobile && isEditMode ? "hidden" : ""} ${isEditorPanelDragging || isMobile ? "" : "transition-[flex-grow] duration-200 ease-in-out"}`}
      >
        {previewPanel}
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  const commentsSidebar = gistId && (
    <CommentsSidebar
      initialCommentValue={newCommentValue}
      comments={comments}
      aiComments={aiReviewComments}
      gistId={gistId}
      onCommentAdded={(comment) => {
        setNewCommentValue("");
        queryClient.setQueryData(
          ["gist-comments", gistId],
          (oldComments: GistComment[]) => {
            return [comment, ...oldComments];
          }
        );
      }}
      onCommentDeleted={(commentId) => {
        if (selectedCommentId === commentId) {
          setSelectedCommentId(null);
        }
        queryClient.setQueryData(
          ["gist-comments", gistId],
          (oldComments: GistComment[]) => {
            return oldComments.filter((comment) => comment.id !== commentId);
          }
        );
      }}
      onCommentUpdated={(comment) => {
        queryClient.setQueryData(
          ["gist-comments", gistId],
          (oldComments: GistComment[]) => {
            return oldComments.map((c) =>
              c.id === comment.id ? comment : c
            );
          }
        );
      }}
      currentUser={currentUser}
      isGistOwner={gist?.owner?.login === currentUser}
      selectedCommentId={selectedCommentId}
      onCommentSelected={setSelectedCommentId}
      onAiCommentDeleted={(id) => {
        if (aiReviewComments.length === 1) {
          setIsCommentSidebarOpen(false);
          setAiResponses((prev) => ({ ...prev, review: undefined }));
        }
        setAiReviewComments((prev) => prev.filter((c) => c.id !== id));
      }}
      onClearAiComments={() => {
        setAiReviewComments([]);
        setAppliedAiComments([]);
        setAiReviewFollowUp(null);
        setReviewReasoningSummary(null);
        setAiReviewTitle(null);
        setAiResponses((prev) => ({ ...prev, review: undefined }));
        setIsCommentSidebarOpen(false);
      }}
      onAcceptAiComment={acceptAiComment}
      appliedAiComments={appliedAiComments}
      isAiCommandInProgress={isAiCommandInProgress}
      isAiReviewInProgress={isAiReviewInProgress}
      aiCommentBeingApplied={aiCommentBeingApplied}
      selectedTab={selectedCommentsTab}
      onTabChange={setSelectedCommentsTab}
      activeAiRequestRequest={activeAiRequestRequest}
      aiRequestTitle={aiReviewTitle}
      onRegenerateAiDiscussion={regenerateAiDiscussion}
      aiFollowUp={aiReviewFollowUp}
      onFollowUp={performAiReview}
      isZenMode={isZenMode}
      reasoningSummary={reviewReasoningSummary || undefined}
      isWebSearching={isWebSearching}
    />
  );

  return (
    <Card className="w-full h-full relative">
      {/* Floating action bar */}
      {!selectedRevisionId &&
        (!isCommentSidebarOpen || // When the comment sidebar is open on mobile, the action bar shouldn't get in the way
          !isMobile) && (
          <ActionBar
            isCommandInProgress={isAiCommandInProgress}
            onSubmitCommand={handleAiCommand}
            isVoiceActive={isVoiceActive}
            startVoiceConversation={startVoiceConversation}
            muteMicrophone={muteMicrophone}
            endConversation={endVoiceConversation}
            hasSelection={hasSelection}
            isMicMuted={isMicMuted}
            whoIsSpeaking={whoIsSpeaking}
            getFrontmatter={getFrontmatter}
            updateFrontmatter={updateFrontmatter}
            getGlobalFrontmatter={getGlobalFrontMatter}
            updateGlobalFrontMatter={updateGlobalFrontMatter}
            isAiEnabled={isAiEnabled}
            onSaveAiSettings={onSaveAiSettings}
            gists={gists?.filter((g) => g.id !== gistId)}
            gistFiles={otherFiles}
            hasSelectedGist={!!gistId}
            aiResponse={showAiResponse ? aiResponse : null}
            aiFollowUp={aiFollowUp}
            reasoningSummary={reasoningSummary || undefined}
            isWebSearching={isWebSearching}
            cancelCommand={cancelAiCommand}
            onCloseAiResponse={() => {
              setShowAiResponse(false);
              setAiResponse(null);
              setAiResponses((prev) => ({ ...prev, ask: undefined }));
            }}
            hasPendingAiEdit={hasPendingAiEdit}
            aiEditStats={aiEditStats || undefined}
            fileContents={content}
            isAiEditInProgress={isAiEditInProgress}
            onAcceptAiEdit={handleSaveWithForkCheck}
            onRejectAiEdit={() => {
              const view = editorRef.current?.view;
              if (view) {
                const result = getChunks(view.state);
                if (result) {
                  for (const chunk of [...result.chunks].reverse()) {
                    rejectChunk(view, chunk.fromB);
                  }
                }
                onHasPendingAiEdit(false);
                setAiEditStats(null);
                setAiResponses((prev) => ({ ...prev, edit: undefined }));
              }
            }}
            showPendingAiDiffs={showPendingAiDiffs}
            onTogglePendingAiDiffs={onTogglePendingAiDiffs}
            onSelectGist={onSelectGist}
            isLoading={isLoading}
          />
        )}

      {/* Toolbar */}
      {!isZenMode && (
        <EditorToolbar
          gistId={gistId}
          gist={gist}
          description={description}
          isEditingDescription={isEditingDescription}
          setIsEditingDescription={setIsEditingDescription}
          onUpdateDescription={handleDescriptionSave}
          isEditingFilename={isEditingFilename}
          setIsEditingFilename={setIsEditingFilename}
          onRenameFile={onRenameFile}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          isCommentSidebarOpen={isCommentSidebarOpen}
          setIsCommentSidebarOpen={setIsCommentSidebarOpen}
          isReadOnly={isReadOnly}
          isLoading={isLoading}
          isStarred={isStarred}
          onStarToggle={onStarToggle}
          selectedRevisionId={selectedRevisionId}
          onSelectRevision={onSelectRevision}
          revisions={revisions}
          isRevisionsLoading={isRevisionsLoading}
          setShowDeleteDialog={setShowDeleteDialog}
          setShowForkDialog={setShowForkDialog}
          setShowAddFileDialog={setShowAddFileDialog}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          handleSaveWithForkCheck={handleSaveWithForkCheck}
          isDeletingFile={isDeletingFile}
          isCommandInProgress={isAiCommandInProgress}
          isCommentsEnabled={isCommentsEnabled}
          commentsCount={comments.length + aiReviewComments.length}
          handleCopyGistUrl={handleCopyGistUrl}
          handleCopyGistHtml={handleCopyGistHtml}
          handleOpenInGithub={handleOpenInGithub}
          onViewFullscreen={onViewFullscreen}
          onToggleZenMode={onToggleZenMode}
        />
      )}

      {/* Main body */}
      {!isMobile ? (
        <ResizablePanelGroup
          direction="horizontal"
          className={isZenMode ? "h-[calc(100vh-4.8rem)]!" : "h-[calc(100vh-8.4rem)]!"}
          onLayout={(sizes) => {
            if (sizes[1] > 0) {
              setCommentPanelSize(sizes[1]);
            }
          }}
        >
          <ResizablePanel
            defaultSize={100 - commentPanelSize}
            minSize={25}
            className="flex"
          >
            {selectedRevisionId && (
              <RevisionBanner
                revision={revisions?.find(
                  (r) => r.version === selectedRevisionId
                )}
                onClearRevision={() => onSelectRevision(null)}
                onRestoreRevision={onRestoreRevision}
                gistCreatedAt={gist?.created_at}
                gistUpdatedAt={gist?.updated_at}
                showChangeStats={!isMobile}
              />
            )}
            <div
              className={`${isSplitMode ? "flex" : "block"} flex-1 ${selectedRevisionId ? "pt-10" : ""}`}
            >
              {editorBody}
            </div>
          </ResizablePanel>
          <ResizableHandle
            className={isCommentSidebarOpen ? "" : "hidden"}
            onDragging={setIsCommentPanelDragging}
          />
          <ResizablePanel
            ref={commentPanelRef}
            defaultSize={commentPanelSize}
            minSize={18}
            collapsible
            onCollapse={() => setIsCommentSidebarOpen(false)}
            className={`flex flex-1 ${isCommentPanelDragging
              ? ""
              : "transition-[flex-grow] duration-200 ease-in-out"
              }`}
          >
            {commentsSidebar}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className={"flex h-[calc(100vh-8.3rem)]"}>
          {selectedRevisionId && (
            <RevisionBanner
              revision={revisions?.find(
                (r) => r.version === selectedRevisionId
              )}
              onClearRevision={() => onSelectRevision(null)}
              onRestoreRevision={onRestoreRevision}
              gistCreatedAt={gist?.created_at}
              gistUpdatedAt={gist?.updated_at}
              showChangeStats={!isMobile}
            />
          )}
          <div
            className={`${isCommentSidebarOpen ? "hidden" : "flex-1"} block ${selectedRevisionId ? "pt-10" : ""}`}
          >
            {editorBody}
          </div>
          <div className={`w-full ${isCommentSidebarOpen ? "" : "hidden"}`}>
            {commentsSidebar}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <DeleteGistDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={onDelete}
        gistDescription={
          selectedFile === "README.md"
            ? description || ""
            : selectedFile?.replace(/\.md$/, "")
        }
        isDeletingFile={isDeletingFile}
      />
      <ForkGistDialog
        isOpen={showForkDialog}
        onOpenChange={setShowForkDialog}
        onConfirm={handleForkAndSave}
      />
      <AddFileDialog
        isOpen={showAddFileDialog}
        onOpenChange={setShowAddFileDialog}
        onSubmit={handleAddFile}
        defaultFilename={suggestedFilename}
      />
    </Card>
  );
}