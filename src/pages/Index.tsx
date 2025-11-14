import { cancelResponse } from "@/agents/openai";
import { pollResearchTask, researchTopic } from "@/agents/research";
import {
  EditorMode,
  editorModeAtom,
  embededdedFileHandlersAtom,
  hasUnsavedChangesAtom,
  selectedGistAtom,
  selectedGistFileAtom,
  selectedHeadingAtom,
} from "@/atoms";
import { WidgetDashboard } from "@/components/dashboard/WidgetDashboard";
import CreateGistDialog from "@/components/dialogs/CreateGistDialog";
import EditTagsDialog from "@/components/dialogs/EditTagsDialog";
import UnsavedChangesDialog from "@/components/editor/dialogs/UnsavedChangesDialog";
import GistEditor, { GistEditorRef } from "@/components/editor/GistEditor";
import GistList from "@/components/list/GistList";
import ResearchStatus from "@/components/research/ResearchStatus";
import { SpotifyConfigDialog } from "@/components/spotify/SpotifyConfigDialog";
import { SpotifyPlayer } from "@/components/spotify/SpotifyPlayer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/hooks/useTheme";
import { RecentlyViewedGistFile, useUserSession } from "@/hooks/useUserSession";
import {
  addGistFile,
  archiveGist,
  createGist,
  createOrUpdateDailyNote,
  deleteGist,
  deleteGistFile,
  duplicateGist,
  fetchGistContent,
  fetchStarredGists,
  fetchUserGists,
  getDefaultFile,
  getGistById,
  getGistDisplayName,
  getGistRevisionContent,
  getGistRevisions,
  getTodayNoteFilename,
  GistData,
  isArchived,
  isDailyNote,
  renameGistFile,
  starGist,
  TEMPLATE_FILENAME,
  unarchiveGist,
  unstarGist,
  updateGistContent,
  updateGistDescription,
  type Gist,
} from "@/lib/github";
import SignInCard from "@/pages/cards/SignInCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useAtom, useAtomValue } from "jotai";
import {
  Calendar,
  Check,
  Clock,
  EyeOff,
  LogOut,
  Music,
  Palette,
  PanelLeftOpen,
  Settings,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

// TODO: Clean up the code around gist selection and URL navigation
// TODO: Remove all calls to invalidate query, in favor of setQueryData

const Index = () => {
  const isMobile = useIsMobile();
  const [selectedGist, setSelectedGist] = useAtom(selectedGistAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedGistFileAtom);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useAtom(
    hasUnsavedChangesAtom
  );
  const [originalContent, setOriginalContent] = useState<string>("");
  const embededdedFileHandlers = useAtomValue(embededdedFileHandlersAtom);

  const [editorMode, setEditorMode] = useAtom(editorModeAtom);
  const [selectedHeading, setSelectedHeading] = useAtom(selectedHeadingAtom);

  const [isZenMode, setIsZenMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (isMobile) return false;

    // We only save/restore the sidebar collapsed state on desktop
    const savedState = localStorage.getItem("gistpad-sidebar-collapsed");
    return savedState ? JSON.parse(savedState) : false;
  });
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);

  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showSpotifyDialog, setShowSpotifyDialog] = useState(false);

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [gistToSwitch, setGistToSwitch] = useState<Gist | null>(null);
  const [fileToSwitch, setFileToSwitch] = useState<string | null>(null);

  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    null
  );
  const [showClearRecentlyViewedDialog, setShowClearRecentlyViewedDialog] =
    useState(false);

  const [hasPendingAiEdit, setHasPendingAiEdit] = useState(false);
  const [showPendingAiDiffs, setShowPendingAiDiffs] = useState(() => {
    const stored = localStorage.getItem("gistpad-show-ai-diffs");
    return stored ? JSON.parse(stored) : true;
  });

  const [activeRefresh, setActiveRefresh] = useState(false);

  const { gistId: urlGistId, filePath: urlFilePath } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const editorRef = useRef<GistEditorRef>(null);
  const { editorThemes } = useTheme();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    // Session state
    isLoggedIn,
    signin,
    signout,
    user,
    // User preferences
    isAutoSaveEnabled,
    showDiffs,
    showFrontmatter,
    showLineNumbers,
    isAiEnabled,
    editorTheme,
    isSpellcheckEnabled,
    pasteImagesAsHtml,
    showArchivedGists,
    showStarredGists,
    recentlyViewedGistFiles,
    showInlineComments,
    showFormattingToolbar,
    pinnedGists,
    toggleAutoSave,
    toggleDiffs,
    toggleFrontmatter,
    toggleLineNumbers,
    toggleSpellcheck,
    togglePasteImagesAsHtml,
    toggleArchivedGists,
    toggleStarredGists,
    toggleInlineComments,
    toggleFormattingToolbar,
    setEditorTheme,
    setAiConfig,
    addGistFileToRecentlyViewed,
    removeGistFilesFromRecentlyViewed,
    clearRecentlyViewedGistFiles,
    researchTasks,
    startResearchTask,
    completeResearchTask,
    deleteResearchTask,
    markResearchTaskAsSeen,
    pinGist,
    unpinGist,
    tags,
    gistTags,
    addTags,
    renameTag,
    deleteTag,
    setTagsForGist,
    getGlobalFrontMatter,
    updateGlobalFrontMatter,
  } = useUserSession();

  const navigate = useNavigate();

  // Data queries
  const queryClient = useQueryClient();

  const {
    data: { gists, archivedGists, dailyNotes } = {
      gists: [],
      archivedGists: [],
      dailyNotes: null,
    },
    isLoading: gistsLoading,
    isFetching: gistsFetching,
  } = useQuery({
    queryKey: ["gists"],
    queryFn: () => fetchUserGists(activeRefresh),
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: starredGists = [] } = useQuery({
    queryKey: ["starred-gists"],
    queryFn: fetchStarredGists,
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const {
    data: gistContent = "",
    isLoading: contentLoading,
    isFetching: contentFetching,
  } = useQuery({
    queryKey: ["gist", selectedGist?.id, selectedFile],
    queryFn: () => fetchGistContent(selectedGist!.id, selectedFile),
    enabled: isLoggedIn && !!selectedGist,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Data queries
  const { data: revisions = null, isLoading: revisionsLoading } = useQuery({
    queryKey: ["gist-revisions", selectedGist?.id],
    queryFn: () => getGistRevisions(selectedGist!.id),
    enabled: !!selectedGist,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Whenever a gist/file is loaded/saved,
  // we have to update the original content. This is used
  // to track changes the user or AI have made. And because
  // we need to wait until the new content is loaded, we
  // can't do this as part of the gist/file selection handler.
  useEffect(() => {
    if (contentLoading || contentFetching) return;
    setOriginalContent(gistContent);
  }, [selectedGist, selectedFile, contentLoading, contentFetching]);

  // Auto-selecting a gist on load and initialize editor mode from URL
  const [loadedDeeplink, setLoadedDeeplink] = useState(false);
  useEffect(() => {
    // We only want to run this effect once, when the
    // user is signed in and hasn't already selected a gist.
    if (loadedDeeplink || gistsLoading || !isLoggedIn) return;

    function initializeEditorFromURL() {
      // Initialize editor mode and selected heading from URL parameters
      const viewParam = searchParams.get("view");
      if (viewParam) {
        console.log("Loading editor mode from URL params");
        setEditorMode(viewParam as EditorMode);
      } else {
        // No explicit view param – choose a sensible default
        if (window.screen.width > 1500) {
          setEditorMode("split");
        } else {
          setEditorMode("edit");
        }
      }

      const headingParam = searchParams.get("heading");
      if (headingParam) {
        console.log("Setting heading based on URL params");
        setSelectedHeading(headingParam);
      }
    }

    if (selectedGist) {
      initializeEditorFromURL();
      return;
    }

    // Check if a gist ID is provided in the URL
    if (urlGistId) {
      getGistById(urlGistId!)
        .then((gist) => {
          setSelectedGist(gist);
          const fileToView =
            urlFilePath && gist.files[urlFilePath]
              ? urlFilePath
              : getDefaultFile(gist);

          setSelectedFile(fileToView);

          if (gist.owner.login !== user?.login) {
            addGistFileToRecentlyViewed(gist, fileToView);
          }

          if (isMobile) {
            setIsSidebarCollapsed(true);
          }

          setLoadedDeeplink(true);
          initializeEditorFromURL();
        })
        .catch(() => {
          // If gist not found, just clear the selection
          setSelectedGist(null);
          setSelectedFile(null);
        });
    } else if (!gistsLoading) {
      if (gists?.length > 0 && !isMobile) {
        setSelectedGist(gists[0]);
        const defaultFile = getDefaultFile(gists[0]);
        setSelectedFile(defaultFile);
      }
      setSelectedRevisionId(null);
      setLoadedDeeplink(true);
      initializeEditorFromURL();
    }
  }, [
    isLoggedIn,
    selectedGist,
    gistsLoading,
    gists,
    urlGistId,
    urlFilePath,
    searchParams,
    setEditorMode,
  ]);

  // Single effect: keep URL in sync with state
  useEffect(() => {
    if (!loadedDeeplink) return;

    let path = "/";
    if (selectedGist) {
      path += selectedGist.id;
      if (selectedFile && selectedFile !== "README.md") {
        path += `/${selectedFile}`;
      }
    }

    const params = new URLSearchParams();
    if (editorMode !== "edit") params.set("view", editorMode);
    if (selectedHeading) params.set("heading", selectedHeading);

    navigate({ pathname: path, search: params.toString() });

    // Keep the document title in sync with the selected gist
    if (selectedGist) {
      document.title = `GistPad - ${getGistDisplayName(selectedGist)}`;
    } else {
      document.title = "GistPad";
    }
  }, [loadedDeeplink, selectedGist, selectedFile, editorMode, selectedHeading]);

  // Persist sidebar collapsed state to localStorage
  useEffect(
    () =>
      localStorage.setItem(
        "gistpad-sidebar-collapsed",
        JSON.stringify(isSidebarCollapsed)
      ),
    [isSidebarCollapsed]
  );

  useEffect(() => {
    if ((!isSidebarCollapsed && !isZenMode) || isMobile) {
      if (isSidebarSheetOpen) {
        setIsSidebarSheetOpen(false);
      }
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientX <= 30 && !isSidebarSheetOpen) {
        setIsSidebarSheetOpen(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isSidebarCollapsed, isMobile, isZenMode, isSidebarSheetOpen]);

  const handleConfirmClearRecentlyViewed = () => {
    clearRecentlyViewedGistFiles();
    setShowClearRecentlyViewedDialog(false);
  };

  const handleSelectRecentGistFile = async (
    recentFile: RecentlyViewedGistFile
  ) => {
    // TODO: Check if the gist has been deleted
    const virtualGist: Gist = {
      id: recentFile.id,
      files: {
        [recentFile.filename]: {
          filename: recentFile.filename,
          language: "Markdown",
          content: "",
        },
      },
      owner: {
        id: recentFile.ownerId,
        login: recentFile.owner,
        avatar_url: `https://avatars.githubusercontent.com/u/${recentFile.ownerId}?v=4`,
      },
      description: recentFile.description,
      updated_at: recentFile.viewedDate,
      created_at: recentFile.viewedDate,
      public: false,
      comments: 0,
    };

    handleGistSelect(virtualGist, recentFile.filename);

    // Move the file to the top of the list
    addGistFileToRecentlyViewed(virtualGist, recentFile.filename);

    const gist = await getGistById(recentFile.id);
    setSelectedGist(gist);
  };

  const handleRefreshGists = async () => {
    setActiveRefresh(true);
    queryClient.invalidateQueries();

    setSelectedGist(null);
    setLoadedDeeplink(false);
  };

  // Add effect to reset activeRefresh when queries finish
  useEffect(() => {
    if (!gistsLoading && !gistsFetching) {
      setActiveRefresh(false);
    }
  }, [gistsLoading, gistsFetching]);

  const handleSaveGist = useCallback(
    async (gistId: string, content: string) => {
      // Check if there was an outstanding timeout
      // for handling-auto-save, and if so clear it.
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = undefined;
      }

      try {
        const extraFiles = embededdedFileHandlers?.map((h) => h());
        const updatedGist = await updateGistContent(
          gistId,
          content,
          selectedFile,
          extraFiles
        );

        // When saving, we're creating a new version so clear revision state
        setSelectedRevisionId(null);
        setOriginalContent(content);
        updateGistState(updatedGist, selectedFile);

        // Add the saved revision to the list of revisions
        queryClient.setQueryData(
          ["gist-revisions", gistId],
          (previousRevisions: any) => [
            updatedGist.history[0],
            ...previousRevisions,
          ]
        );

        // If this was a fork (gistId different from selectedGist.id), we need to:
        // 1. Update the selected gist
        // 2. Navigate to the new gist URL
        // 3. Refresh the gists list
        if (selectedGist && gistId !== selectedGist.id) {
          const forkedGist = await getGistById(gistId);
          updateGistState(forkedGist, selectedFile);
        }
      } catch (error) {
        toast("Error", { description: "Failed to update gist" });
      }
    },
    [embededdedFileHandlers, selectedGist, selectedFile]
  );

  const handleGistSelect = useCallback(
    (gist?: Gist, filename?: string) => {
      // If no gist is set, then that means the user
      // just de-selected a gist. So clear the selection
      if (!gist) {
        setSelectedGist(null);
        setSelectedFile(null);
        return;
      }

      // If the selected gist/file is being re-selected, then simply no-op
      if (
        gist.id === selectedGist?.id &&
        (!filename || filename === selectedFile)
      ) {
        if (isMobile) setIsSidebarCollapsed(true);

        return;
      }

      // Clear any state from the previous gist
      setSelectedHeading(null);
      setHasPendingAiEdit(false);
      setSelectedRevisionId(null);

      const selectedFileName = filename || getDefaultFile(gist);
      if (hasUnsavedChanges) {
        if (isAutoSaveEnabled) {
          // Auto-save current changes before switching
          handleSaveGist(selectedGist!.id, gistContent).then(() => {
            setSelectedGist(gist);
            setSelectedFile(selectedFileName);
            if (isMobile) {
              setIsSidebarCollapsed(true);
            }
          });
        } else {
          setGistToSwitch(gist);
          setFileToSwitch(selectedFileName);
          setShowUnsavedDialog(true);
        }
      } else {
        setSelectedGist(gist);
        setSelectedFile(selectedFileName);
        if (isMobile) {
          setIsSidebarCollapsed(true);
        }
      }
    },
    [
      selectedGist,
      selectedFile,
      hasUnsavedChanges,
      isAutoSaveEnabled,
      gistContent,
      isMobile,
      handleSaveGist,
    ]
  );

  // Update the internal gist state and query cache
  // any time a mutation happens (create, update, delete)
  const updateGistState = useCallback(
    (updatedGist: Gist, filename?: string) => {
      const isDaily = isDailyNote(updatedGist);
      const isGistArchived = isArchived(updatedGist);

      queryClient.setQueryData(["gists"], (previousGistData: GistData) => {
        if (isDaily) {
          return {
            ...previousGistData,
            dailyNotes: updatedGist,
          };
        }

        // Check if the gist was previously in a different list (archived vs regular)
        const wasInRegularList = previousGistData.gists.some(
          (g) => g.id === updatedGist.id
        );
        const wasInArchivedList = previousGistData.archivedGists.some(
          (g) => g.id === updatedGist.id
        );

        // If archived state changed, we need to move it between lists
        if (isGistArchived && wasInRegularList) {
          // Gist was moved to archived
          return {
            ...previousGistData,
            gists: previousGistData.gists.filter(
              (g) => g.id !== updatedGist.id
            ),
            archivedGists: [updatedGist, ...previousGistData.archivedGists],
          };
        } else if (!isGistArchived && wasInArchivedList) {
          // Gist was moved from archived to regular
          return {
            ...previousGistData,
            archivedGists: previousGistData.archivedGists.filter(
              (g) => g.id !== updatedGist.id
            ),
            gists: [updatedGist, ...previousGistData.gists],
          };
        } else if (isGistArchived) {
          // Just update within archived list
          return {
            ...previousGistData,
            archivedGists: [
              updatedGist,
              ...previousGistData.archivedGists.filter(
                (g) => g.id !== updatedGist.id
              ),
            ],
          };
        } else {
          // Just update within regular list
          return {
            ...previousGistData,
            gists: [
              updatedGist,
              ...previousGistData.gists.filter((g) => g.id !== updatedGist.id),
            ],
          };
        }
      });

      setHasUnsavedChanges(false);
      setHasPendingAiEdit(false);
      handleGistSelect(updatedGist, filename);
    },
    [queryClient, handleGistSelect]
  );

  const handleViewFullscreen = useCallback(
    (gistId?: string) => {
      if (!selectedGist && !gistId) return;

      const selectedGistId = gistId || selectedGist.id;
      const filePath =
        !gistId && selectedFile !== "README.md" ? `/${selectedFile}` : "";

      navigate(`/share/${selectedGistId}${filePath}`);
    },
    [selectedGist, selectedFile, navigate]
  );

  const togglePendingAiDiffs = useCallback(() => {
    const enabled = !showPendingAiDiffs;
    setShowPendingAiDiffs(enabled);
    localStorage.setItem("gistpad-show-ai-diffs", JSON.stringify(enabled));
  }, [showPendingAiDiffs]);

  const handleContentChange = useCallback(
    (content: string, saveImmediately: boolean = false) => {
      queryClient.setQueryData(
        ["gist", selectedGist?.id, selectedFile],
        content
      );

      if (saveImmediately) {
        handleSaveGist(selectedGist!.id, content);
      } else {
        const hasChanges = content !== originalContent;
        setHasUnsavedChanges(hasChanges);

        // If the user undid or rejected all the AI
        // edits, then reset the editor to non-diff mode
        if (!hasChanges) {
          setHasPendingAiEdit(false);
        }
      }
    },
    [queryClient, selectedGist, selectedFile, originalContent]
  );

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = undefined;
    }

    if (
      !selectedGist ||
      !isAutoSaveEnabled ||
      !hasUnsavedChanges ||
      hasPendingAiEdit // Don't auto-save AI edits
    ) {
      return;
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      await handleSaveGist(selectedGist.id, gistContent);
      autoSaveTimeoutRef.current = undefined;
    }, 5000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = undefined;
      }
    };
  }, [
    gistContent,
    selectedGist,
    isAutoSaveEnabled,
    hasUnsavedChanges,
    hasPendingAiEdit,
    handleSaveGist,
  ]);

  // Auto-save on tab visibility change, or before unload
  useEffect(() => {
    const handleAutoSave = async () => {
      if (selectedGist && hasUnsavedChanges && !hasPendingAiEdit) {
        await handleSaveGist(selectedGist.id, gistContent);
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        await handleAutoSave();
      }
    };

    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      await handleAutoSave();
    };

    // Add all event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Clean up all event listeners
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    selectedGist,
    isAutoSaveEnabled,
    hasUnsavedChanges,
    gistContent,
    handleSaveGist,
    hasPendingAiEdit,
  ]);

  const handleCreateGist = useCallback(
    async (
      description?: string,
      initialContent?: string,
      isPublic?: boolean,
      selectedTags?: string[]
    ) => {
      const toastId = toast.loading("Creating gist...", { dismissible: false });

      try {
        const newGist = await createGist(description, initialContent, isPublic);

        // If the user is currently in preview mode, then we
        // need to switch into edit mode. But we'll retain split view.
        if (
          searchParams.has("view") &&
          searchParams.get("view") === "preview"
        ) {
          // Make sure we put the editor into edit mode
          setSearchParams((searchParams) => {
            searchParams.delete("view");
            return searchParams;
          });
        }

        // Associate tags with the new gist if any were selected
        if (selectedTags && selectedTags.length > 0) {
          setTagsForGist(newGist.id, selectedTags);
        }

        updateGistState(newGist, "README.md");

        setTimeout(() => editorRef.current?.setCursorToEnd(), 500);

        toast.dismiss(toastId);
      } catch (error) {
        toast.error("Failed to create gist");
      }
    },
    [queryClient, isMobile, searchParams, editorRef, updateGistState]
  );

  const handleUpdateDescription = async (
    gistId: string,
    description: string
  ) => {
    try {
      // Find the gist to check if it's archived
      const gist =
        gists.find((g) => g.id === gistId) ||
        archivedGists.find((g) => g.id === gistId) ||
        (selectedGist?.id === gistId ? selectedGist : null);

      // If gist is archived, make sure to preserve the [Archived] suffix
      let newDescription = description;
      if (gist && isArchived(gist)) {
        newDescription = `${description.trim()} [Archived]`;
      }

      const updatedGist = await updateGistDescription(gistId, newDescription);
      updateGistState(updatedGist);
    } catch (error) {
      toast.error("Failed to update description");
    }
  };

  // TODO: Refactor the query state logic
  // TODO: Split this into two functions: delete file and delete gist
  const handleGistDelete = useCallback(
    async (gistId: string = selectedGist.id, filename?: string) => {
      try {
        const deletedFile = filename || selectedFile;
        if (deletedFile && deletedFile !== "README.md") {
          // Delete just the selected file
          const updatedGist = await deleteGistFile(gistId, deletedFile);

          // If this was the last file, delete the entire gist
          if (Object.keys(updatedGist.files).length === 0) {
            await deleteGist(gistId);

            // Remove from pinned gists if it was pinned
            unpinGist(gistId);

            if (dailyNotes && dailyNotes.id === gistId) {
              queryClient.setQueryData(
                ["gists"],
                (previousGistData: GistData) => {
                  return {
                    ...previousGistData,
                    dailyNotes: null,
                  };
                }
              );
            } else {
              queryClient.setQueryData(
                ["gists"],
                (previousGistData: GistData) => {
                  return {
                    ...previousGistData,
                    gists: previousGistData.gists.filter(
                      (g) => g.id !== gistId
                    ),
                  };
                }
              );
            }
          } else {
            updateGistState(updatedGist, selectedFile);
          }
        } else {
          // Delete the entire gist
          await deleteGist(gistId);

          // Remove from pinned gists if it was pinned
          unpinGist(gistId);

          queryClient.setQueryData(["gists"], (previousGistData: GistData) => {
            // Check if the gist is in the archived list and remove it from there if needed
            const isGistArchived = previousGistData.archivedGists.some(
              (g) => g.id === gistId
            );

            return {
              ...previousGistData,
              gists: previousGistData.gists.filter((g) => g.id !== gistId),
              archivedGists: isGistArchived
                ? previousGistData.archivedGists.filter((g) => g.id !== gistId)
                : previousGistData.archivedGists,
            };
          });
        }

        // Clear selection if we deleted the current gist or its last file
        if (selectedGist && selectedGist.id === gistId) {
          // TODO: This is wierd, but it allows us to tell
          // the gist list to re-select the top gist.
          setLoadedDeeplink(false);
          setSelectedGist(null);
          setHasUnsavedChanges(false);
          setHasPendingAiEdit(false);

          if (isMobile) {
            setIsSidebarCollapsed(false);
          }
        }
      } catch (error) {
        const message =
          selectedFile !== "README.md"
            ? "Failed to delete file"
            : "Failed to delete gist";

        toast.error(message);
      }
    },
    [
      queryClient,
      selectedGist,
      selectedFile,
      isMobile,
      updateGistState,
      unpinGist,
    ]
  );

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);

    if (gistToSwitch) {
      // Reset the data cache back to the original content
      queryClient.setQueryData(
        ["gist", selectedGist.id, selectedFile],
        originalContent
      );

      setSelectedGist(gistToSwitch);
      setSelectedFile(fileToSwitch || "README.md");
      if (isMobile) {
        setIsSidebarCollapsed(true);
      }
    }
    setGistToSwitch(null);
    setFileToSwitch(null);
  }, [
    gistToSwitch,
    fileToSwitch,
    isMobile,
    originalContent,
    setSelectedRevisionId,
  ]);

  const handleSaveBeforeSwitch = useCallback(async () => {
    if (!selectedGist) return;

    // Close dialog and update UI state immediately
    setShowUnsavedDialog(false);
    await handleSaveGist(selectedGist.id, gistContent);

    if (gistToSwitch) {
      setSelectedGist(gistToSwitch);
      setSelectedFile(fileToSwitch || "README.md");
      if (isMobile) {
        setIsSidebarCollapsed(true);
      }
    }

    setGistToSwitch(null);
    setFileToSwitch(null);
  }, [
    selectedGist,
    gistContent,
    gistToSwitch,
    fileToSwitch,
    isMobile,
    handleSaveGist,
    setSelectedRevisionId,
  ]);

  const [isRevisionLoading, setIsRevisionLoading] = useState(false);
  const handleSelectRevision = async (revisionId: string | null) => {
    if (!selectedGist) return;

    setIsRevisionLoading(true);

    try {
      if (revisionId === null) {
        // Reset to current version
        setSelectedRevisionId(null);
        const currentContent = await fetchGistContent(
          selectedGist.id,
          selectedFile
        );
        queryClient.setQueryData(
          ["gist", selectedGist.id, selectedFile],
          currentContent
        );
        setOriginalContent(currentContent);
        return;
      }

      const selectedRevisionIndex = revisions.findIndex(
        (rev) => rev.version === revisionId
      );
      if (selectedRevisionIndex === -1) return;

      // Get the selected and previous revision contents
      const [selectedRevisionGist, previousRevisionGist] = await Promise.all([
        getGistRevisionContent(selectedGist.id, revisionId),
        selectedRevisionIndex < revisions.length - 1
          ? getGistRevisionContent(
            selectedGist.id,
            revisions[selectedRevisionIndex + 1].version
          )
          : null,
      ]);

      const selectedRevisionContent =
        selectedRevisionGist.files[selectedFile]?.content || "";

      const previousRevisionContent =
        previousRevisionGist?.files[selectedFile]?.content || "";

      // First set the revision ID to enable diff view
      setSelectedRevisionId(revisionId);

      // Then update the content states, always using the previous revision as base
      setOriginalContent(previousRevisionContent);
      queryClient.setQueryData(
        ["gist", selectedGist.id, selectedFile],
        selectedRevisionContent
      );
    } catch (error) {
      toast.error("Failed to fetch revision content");
    } finally {
      setIsRevisionLoading(false);
    }
  };

  const handleRestoreRevision = useCallback(async () => {
    if (!selectedGist) return;

    setSelectedRevisionId(null);
    setIsRevisionLoading(true);

    // The current content is already set to the revision
    // and so the only thing we need to do is set the original content to it.
    const currentContent = await fetchGistContent(
      selectedGist.id,
      selectedFile
    );

    setOriginalContent(currentContent);
    setIsRevisionLoading(false);
    setHasUnsavedChanges(true);
  }, [selectedGist, selectedFile]);

  // Determine if the current gist is read-only
  const isReadOnly = useMemo(() => {
    if (!selectedGist || !isLoggedIn) return true;
    return selectedGist.owner?.login !== user?.login;
  }, [selectedGist, isLoggedIn, user?.login]);

  const handleOpenTodaysNote = useCallback(async () => {
    const filename = getTodayNoteFilename();

    try {
      // If we have daily notes, check if today's note exists
      if (dailyNotes && dailyNotes.files[filename]) {
        searchParams.delete("heading");
        setSearchParams(searchParams);

        setSelectedGist(dailyNotes);
        setSelectedFile(filename);

        setTimeout(() => editorRef.current?.setCursorToEnd(), 500);
        if (isMobile) {
          setIsSidebarCollapsed(true);
        }
        return;
      }

      const toastId = toast.loading("Creating daily note...", {
        dismissible: false,
      });

      // Create/update daily note using template or default content
      const updatedGist = await createOrUpdateDailyNote(dailyNotes);
      updateGistState(updatedGist, filename);

      searchParams.delete("heading");
      setSearchParams(searchParams);

      setTimeout(() => editorRef.current?.setCursorToEnd(), 500);

      if (isMobile) {
        setIsSidebarCollapsed(true);
      }

      toast.dismiss(toastId);
    } catch (error) {
      toast.error("Failed to open daily note");
    }
  }, [dailyNotes, queryClient, isMobile, updateGistState]);

  const handleStarToggle = async (gistId: string) => {
    try {
      const isCurrentlyStarred = starredGists.some((g) => g.id === gistId);
      if (isCurrentlyStarred) {
        await unstarGist(gistId);
        // Update starred gists cache
        queryClient.setQueryData(
          ["starred-gists"],
          (previousGists: Gist[] = []) => {
            return previousGists.filter((gist) => gist.id !== gistId);
          }
        );
      } else {
        await starGist(gistId);
        // Add to starred gists cache
        const gistToAdd = gists?.find((g) => g.id === gistId) || selectedGist;
        if (gistToAdd) {
          queryClient.setQueryData(
            ["starred-gists"],
            (previousGists: Gist[] = []) => {
              return [gistToAdd, ...previousGists];
            }
          );

          removeGistFilesFromRecentlyViewed(gistId);
        }
      }
    } catch (error) {
      const message = starredGists.some((g) => g.id === gistId)
        ? "Failed to unstar gist"
        : "Failed to star gist";

      toast.error(message);
    }
  };

  const handlePinToggle = async (gistId: string) => {
    try {
      const isPinned = pinnedGists.includes(gistId);
      if (isPinned) {
        unpinGist(gistId);
      } else {
        pinGist(gistId);
      }
    } catch (error) {
      const message = pinnedGists.includes(gistId)
        ? "Failed to unpin gist"
        : "Failed to pin gist";

      toast.error(message);
    }
  };

  const handleArchiveToggle = async (gistId: string) => {
    const gist =
      gists.find((g) => g.id === gistId) ||
      archivedGists.find((g) => g.id === gistId) ||
      (selectedGist?.id === gistId ? selectedGist : null);

    const isCurrentlyArchived = isArchived(gist);
    const updatedGist = isCurrentlyArchived
      ? await unarchiveGist(gist)
      : await archiveGist(gist);

    updateGistState(updatedGist);
  };

  const handleSelectFile = useCallback(
    (filename: string): boolean => {
      if (filename === selectedFile) return true;

      // Clear any previous file state
      setSelectedHeading(null);
      setSelectedRevisionId(null);

      if (hasUnsavedChanges) {
        if (isAutoSaveEnabled) {
          // Auto-save current changes before switching files
          handleSaveGist(selectedGist!.id, gistContent).then(() => {
            setTimeout(() => setSelectedFile(filename), 200);
          });
          return true;
        } else {
          setGistToSwitch(selectedGist);
          setFileToSwitch(filename);
          setTimeout(() => setShowUnsavedDialog(true), 200);
          return false;
        }
      } else {
        setSelectedFile(filename);
        return true;
      }
    },
    [
      selectedFile,
      hasUnsavedChanges,
      searchParams,
      isAutoSaveEnabled,
      gistContent,
      selectedGist,
      handleSaveGist,
    ]
  );

  const handleAddFile = useCallback(
    async (gistId: string, filename: string, content?: string) => {
      try {
        const updatedGist = await addGistFile(gistId, filename, content);
        if (
          searchParams.has("view") &&
          searchParams.get("view") === "preview"
        ) {
          // Make sure we put the editor into edit mode
          setSearchParams((searchParams) => {
            searchParams.delete("view");
            return searchParams;
          });
        }

        updateGistState(updatedGist, filename);
        setTimeout(() => editorRef.current?.setCursorToEnd(), 500);
      } catch (error) {
        toast.error("Failed to add file");
      }
    },
    [updateGistState, searchParams, editorRef]
  );

  const handleRenameFile = useCallback(
    async (oldFilename: string, newFilename: string) => {
      if (!selectedGist) return;
      try {
        const updatedGist = await renameGistFile(
          selectedGist.id,
          oldFilename,
          newFilename
        );

        updateGistState(updatedGist, newFilename);
      } catch (error) {
        toast.error("Failed to rename file");
        throw error; // Re-throw so the editor component can handle the error state
      }
    },
    [selectedGist, queryClient]
  );

  const handleDuplicateGist = useCallback(
    async (gistId: string) => {
      try {
        const toastId = toast.loading("Duplicating gist...");

        const duplicatedGist = await duplicateGist(gistId);
        updateGistState(duplicatedGist);

        toast.dismiss(toastId);
      } catch (error) {
        toast.error("Failed to duplicate gist");
      }
    },
    [updateGistState, isMobile]
  );

  // keep the latest tasks in a ref so the timeout never goes stale
  const tasksRef = useRef(researchTasks);
  useEffect(() => {
    tasksRef.current = researchTasks;
  }, [researchTasks]);

  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!researchTasks.some((t) => !t.content)) return;
    if (pollingTimeoutRef.current) return;

    const poll = async () => {
      const pending = tasksRef.current.filter((t) => !t.content);
      if (pending.length === 0) {
        pollingTimeoutRef.current = null;
        return;
      }

      let completedFirstTask = false;
      for await (const task of pending) {
        const res = await pollResearchTask(task.id);
        if (res) {
          completeResearchTask(task.id, res.title, res.filename, res.content);
          completedFirstTask = true;
          break;
        }
      }

      // Queue the next poll if either we didn't complete a task
      // or there were additional pending tasks beyond the one we handled.
      const needsAnotherPoll = !completedFirstTask || pending.length > 1;
      pollingTimeoutRef.current = needsAnotherPoll
        ? setTimeout(poll, 3000)
        : null;
    };

    poll();

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [researchTasks, completeResearchTask]);

  const handleToggleTag = (
    gistId: string,
    tagId: string,
    selected: boolean
  ) => {
    const currentTags = gistTags[gistId] || [];
    let newTags: string[];

    if (selected) {
      // Add the tag if it's not already there
      newTags = currentTags.includes(tagId)
        ? currentTags
        : [...currentTags, tagId];
    } else {
      // Remove the tag
      newTags = currentTags.filter((id) => id !== tagId);
    }

    // Update the gist's tags
    setTagsForGist(gistId, newTags);
  };

  const handleOpenDailyTemplate = useCallback(async () => {
    try {
      // Check if template.md already exists
      if (dailyNotes?.files[TEMPLATE_FILENAME]) {
        // Open existing template
        setSelectedGist(dailyNotes);
        setSelectedFile(TEMPLATE_FILENAME);
      } else if (dailyNotes) {
        // Create template.md with default content
        const updatedGist = await addGistFile(
          dailyNotes.id,
          TEMPLATE_FILENAME,
          `# 📆 {{date}}\n\n`
        );
        updateGistState(updatedGist, TEMPLATE_FILENAME);
      }

      if (isMobile) {
        setIsSidebarCollapsed(true);
      }
    } catch (error) {
      toast.error("Failed to create template");
    }
  }, [isMobile, updateGistState, dailyNotes]);

  // Check if we're in development mode
  const isDevMode = import.meta.env.VITE_DEV_MODE === "true";

  // Only show the sign-in screen if not in dev mode and not logged in
  if (!isLoggedIn && !isDevMode) {
    return <SignInCard onSignIn={signin} />;
  }

  const userSettingsMenuItems = (
    <>
      {recentlyViewedGistFiles.length > 0 && (
        <>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Clock className="h-4 w-4 mr-2" />
              Recently viewed
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
              {recentlyViewedGistFiles.map((recentFile) => {
                const isSelected =
                  selectedGist?.id === recentFile.id &&
                  selectedFile === recentFile.filename;
                return (
                  <DropdownMenuItem
                    key={`${recentFile.id}-${recentFile.filename}`}
                    onClick={() => handleSelectRecentGistFile(recentFile)}
                    className={
                      isSelected ? "bg-primary text-primary-foreground" : ""
                    }
                  >
                    <div className="flex flex-col max-w-[200px]">
                      <div className="flex items-center">
                        <span className="font-medium">
                          {recentFile.description}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(recentFile.viewedDate), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setTimeout(() => setShowClearRecentlyViewedDialog(true), 200)
                }
              >
                <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                Clear recent list
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onClick={toggleAutoSave}>
        {isAutoSaveEnabled ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <span className="w-4 mr-2" />
        )}
        Auto-save changes
      </DropdownMenuItem>
      <DropdownMenuItem onClick={toggleSpellcheck}>
        {isSpellcheckEnabled ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <span className="w-4 mr-2" />
        )}
        Enable spell checking
      </DropdownMenuItem>
      <DropdownMenuItem onClick={toggleLineNumbers}>
        {showLineNumbers ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <span className="w-4 mr-2" />
        )}
        Show line numbers
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Palette className="h-4 w-4 mr-2" />
          Editor theme
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {Object.keys(editorThemes).map((themeName) => {
            const isSelected = editorTheme === themeName;
            return (
              <DropdownMenuItem
                key={themeName}
                onClick={() => setEditorTheme(themeName)}
                className={
                  isSelected
                    ? "bg-primary text-primary-foreground font-medium"
                    : ""
                }
              >
                {themeName}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Settings className="h-4 w-4 mr-2" />
          Advanced settings
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={toggleStarredGists}>
            {showStarredGists ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="w-4 mr-2" />
            )}
            Show starred gists
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleArchivedGists}>
            {showArchivedGists ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="w-4 mr-2" />
            )}
            Show archived gists
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleDiffs}>
            {showDiffs ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="w-4 mr-2" />
            )}
            Enable diff tracking
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleFrontmatter}>
            {showFrontmatter ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="w-4 mr-2" />
            )}
            Show frontmatter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleInlineComments}>
            {showInlineComments ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="w-4 mr-2" />
            )}
            Show inline comments
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleFormattingToolbar}>
            {showFormattingToolbar ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="w-4 mr-2" />
            )}
            Show formatting toolbar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={togglePasteImagesAsHtml}>
            {pasteImagesAsHtml ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="w-4 mr-2" />
            )}
            Paste images as HTML
          </DropdownMenuItem>
          {!isMobile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSpotifyDialog(true)}>
                <Music className="h-4 w-4 mr-2" />
                Configure Spotify...
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={signout}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </DropdownMenuItem>
    </>
  );

  const renderGistList = (allowCollapse: boolean = true) => (
    <GistList
      gists={gists || []}
      starredGists={starredGists}
      archivedGists={archivedGists}
      dailyNotes={dailyNotes}
      selectedGistId={selectedGist?.id || null}
      selectedFile={selectedFile}
      onSelectGist={handleGistSelect}
      onDelete={handleGistDelete}
      isLoading={gistsLoading || activeRefresh}
      onRefresh={handleRefreshGists}
      onStarToggle={handleStarToggle}
      onArchiveToggle={handleArchiveToggle}
      onPinToggle={handlePinToggle}
      pinnedGists={pinnedGists}
      onDuplicateGist={handleDuplicateGist}
      onCreateGist={handleCreateGist}
      onOpenTodaysNote={handleOpenTodaysNote}
      showArchivedGists={showArchivedGists}
      showStarredGists={showStarredGists}
      onViewFullscreen={handleViewFullscreen}
      onOpenDailyTemplate={handleOpenDailyTemplate}
      tags={tags}
      gistTags={gistTags}
      filterTagIds={tagFilters}
      onFilterTagIdsChange={setTagFilters}
      onEditTags={() => setShowTagDialog(true)}
      onDeleteTag={deleteTag}
      onToggleTag={handleToggleTag}
      researchTasks={researchTasks}
      hasUnsavedChanges={hasUnsavedChanges}
      onToggleCollapse={allowCollapse ? () => setIsSidebarCollapsed(true) : undefined}
    />
  );

  return (
    <div className="container h-screen grid grid-rows-[auto_1fr] gap-2">
      {/* Sidebar hover sheet when the sidebar is collapsed */}
      {(isSidebarCollapsed || isZenMode) && !isMobile && (
        <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
          <SheetContent
            side="left"
            className="w-[325px] border-r-0 [&>button]:hidden"
            onPointerLeave={() => setIsSidebarSheetOpen(false)}
          >
            {renderGistList(false)}
          </SheetContent>
        </Sheet>
      )
      }
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold flex gap-2">
            <img
              src={
                user?.login === "lostintangent1"
                  ? "/scratch.svg"
                  : "/icon.png"
              }
              className="w-8"
            />{" "}
            GistPad
            {!isMobile && !isZenMode && (
              <span className="ml-2 px-2 py-0 border border-gray-400 text-gray-400 text-xs font-medium rounded-full flex items-center">
                Experimental
              </span>
            )}
          </h1>
          {isSidebarCollapsed && !isZenMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(false)}
              className="h-8 w-8"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex gap-2 items-center mt-1">
          <ResearchStatus
            tasks={researchTasks}
            onDeleteTaskResults={(id) => deleteResearchTask(id)}
            onCancelTask={async (id) => {
              await cancelResponse(id);
              deleteResearchTask(id);
            }}
            onSaveTaskResults={async (task) => {
              if (task.gistId) {
                await handleAddFile(task.gistId, task.filename, task.content);
              } else {
                await handleCreateGist(task.title, task.content);
              }
              deleteResearchTask(task.id);
            }}
            onViewTaskResults={markResearchTaskAsSeen}
          />
          {!isZenMode && (
            <>
              <WidgetDashboard />
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenTodaysNote}
                title="Open today's note"
              >
                <Calendar className="h-4 w-4" />
              </Button>
              <CreateGistDialog onSubmit={handleCreateGist} tags={tags} />
            </>
          )}
          {isZenMode && (
            <div className="flex items-center">
              {hasUnsavedChanges && (
                <span className="bg-blue-500 w-2 h-2 rounded-full mr-2" />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsZenMode(false)}
                className="gap-2 items-center"
              >
                <EyeOff className="h-4 w-4" />
                Exit zen mode
              </Button>
            </div>
          )}
          {!isZenMode && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 w-8 p-0 mt-1"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback>{user?.initial}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {userSettingsMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Main content */}
      <div
        className={`grid flex-1 min-h-0 ${!isMobile && !isSidebarCollapsed && !isZenMode ? "gap-2" : ""} ${isMobile ? "" : "transition-[grid-template-columns] duration-200 ease-in-out"}`}
        style={{
          // Animate the sidebar width when collapsing/expanding
          gridTemplateColumns: isZenMode
            ? "0px 1fr"
            : isMobile
              ? isSidebarCollapsed
                ? "0px 1fr"
                : "1fr 0px"
              : `${isSidebarCollapsed ? "0px" : "325px"} 1fr`,
        }}
      >
        {/* Gist list sidebar */}
        <div
          className={`overflow-hidden ${isMobile ? "" : "transition-[width,opacity] duration-200 ease-in-out"} ${isSidebarCollapsed || isZenMode
            ? "w-0 opacity-0"
            : "w-full opacity-100"
            }`}
        >
          {renderGistList()}
        </div>

        {/* Gist editor */}
        <div
          className={
            isMobile ? (isSidebarCollapsed || isZenMode ? "" : "hidden") : ""
          }
        >
          <GistEditor
            ref={editorRef}
            content={gistContent}
            originalContent={originalContent}
            gistId={selectedGist?.id}
            gist={selectedGist}
            description={
              selectedGist?.description?.replace(/\s*\[Archived\]$/, "") || ""
            }
            selectedFile={selectedFile}
            onSelectGist={(gistId) => {
              const gist = gists.find((g) => g.id === gistId);
              handleGistSelect(gist);
            }}
            onSelectFile={handleSelectFile}
            onSave={handleSaveGist}
            onUpdateDescription={handleUpdateDescription}
            onDelete={handleGistDelete}
            onRenameFile={handleRenameFile}
            showDiff={
              showDiffs ||
              (hasPendingAiEdit && showPendingAiDiffs) ||
              selectedRevisionId !== null
            }
            showFrontmatter={showFrontmatter}
            showLineNumbers={showLineNumbers}
            showFormattingToolbar={showFormattingToolbar}
            isLoading={contentLoading || isRevisionLoading}
            onCreateGist={handleCreateGist}
            isAiEnabled={isAiEnabled}
            onSaveAiSettings={setAiConfig}
            gists={gists}
            hasUnsavedChanges={hasUnsavedChanges}
            onHasPendingAiEdit={(value = true) => setHasPendingAiEdit(value)}
            hasPendingAiEdit={hasPendingAiEdit}
            showPendingAiDiffs={showPendingAiDiffs}
            onTogglePendingAiDiffs={togglePendingAiDiffs}
            onContentChange={handleContentChange}
            isReadOnly={isReadOnly}
            currentUser={user?.login}
            isStarred={
              selectedGist
                ? starredGists.some((g) => g.id === selectedGist.id)
                : false
            }
            onStarToggle={handleStarToggle}
            editorTheme={editorThemes[editorTheme]}
            onAddFile={handleAddFile}
            selectedRevisionId={selectedRevisionId}
            onSelectRevision={handleSelectRevision}
            onRestoreRevision={handleRestoreRevision}
            revisions={revisions}
            isRevisionsLoading={revisionsLoading}
            isSpellCheckEnabled={isSpellcheckEnabled}
            pasteImagesAsHtml={pasteImagesAsHtml}
            showInlineComments={isZenMode ? false : showInlineComments}
            isZenMode={isZenMode}
            onToggleZenMode={() => {
              setIsZenMode(true);
              setEditorMode("split");
            }}
            onViewFullscreen={handleViewFullscreen}
            getGlobalFrontMatter={getGlobalFrontMatter}
            updateGlobalFrontMatter={updateGlobalFrontMatter}
            onResearchTopic={async (topic, context, userComments) => {
              try {
                const id = await researchTopic(
                  topic,
                  selectedGist?.description?.replace(/\s*\[Archived\]$/, ""),
                  context,
                  userComments
                );

                startResearchTask(id, selectedGist?.id, topic);
              } catch (error) {
                toast.error("Failed to generate file");
              }
            }}
          />
        </div>
      </div>

      {/* Dialogs */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveBeforeSwitch}
      />

      <EditTagsDialog
        isOpen={showTagDialog}
        onOpenChange={setShowTagDialog}
        tags={tags}
        addTags={addTags}
        renameTag={renameTag}
        deleteTag={deleteTag}
      />

      <SpotifyConfigDialog
        open={showSpotifyDialog}
        onOpenChange={setShowSpotifyDialog}
      />

      <AlertDialog
        open={showClearRecentlyViewedDialog}
        onOpenChange={setShowClearRecentlyViewedDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recently viewed files</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear your recently viewed files?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmClearRecentlyViewed}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SpotifyPlayer />
    </div>
  );
};

export default Index;
