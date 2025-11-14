import { selectedGistAtom, selectedGistFileAtom } from "@/atoms";
import { supabase } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export interface RecentlyViewedGistFile {
  id: string;
  description: string;
  owner: string;
  ownerId: number;
  filename: string;
  viewedDate: string;
}

interface UserProfile {
  login: string;
  avatar_url: string;
  initial: string;
}

export interface TagData {
  name: string;
  color: string;
}

export interface ResearchTask {
  id: string;
  gistId?: string;
  topic: string;
  startedTime: string;
  completedTime?: string;
  title?: string;
  filename?: string;
  content?: string;
  hasBeenSeen?: boolean;
}

interface UserMetadata {
  isAutoSaveEnabled?: boolean;
  showDiffs?: boolean;
  showFrontmatter?: boolean;
  editorTheme?: string;
  showLineNumbers?: boolean;
  isSpellcheckEnabled?: boolean;
  pasteImagesAsHtml?: boolean;
  showArchivedGists?: boolean;
  showStarredGists?: boolean;
  recentlyViewedGistFiles?: RecentlyViewedGistFile[];
  showInlineComments?: boolean;
  showFormattingToolbar?: boolean;
  pinnedGists?: string[]; // Array of pinned gist IDs
  tags?: Record<string, TagData>;
  gistTags?: Record<string, string[]>;
  globalFrontMatter?: string; // YAML string for global AI settings
  researchTasks?: ResearchTask[];
}

const TOKEN_CACHE_KEY = "gistpad-github-token";
export function getGitHubToken() {
  return localStorage.getItem(TOKEN_CACHE_KEY);
}

const DEFAULT_FRONTMATTER = `{
  "edit": {
    "commands": {
      "fix": "Fix any issues in this document, such as typos, grammar errors, or formatting problems.",
      "improve": "Improve the quality of this document, such as enhancing clarity, conciseness, or completeness.",
      "expand": "Expand on the content of this document, adding more details or examples."
    }
  },
  "discuss": {
    "commands": {
      "clarity": "Provide suggestions for improving the clarity of this document.",
      "conciseness": "Provide suggestions for making this document more concise.",
      "completeness": "Provide suggestions for making this document more complete."
    }
  }
}`;

export function useUserSession() {
  const [user, setUser] = useState<User | null>(null);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
  const [showDiffs, setShowDiffs] = useState(false);
  const [showFrontmatter, setShowFrontmatter] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [editorTheme, _setEditorTheme] = useState("GitHub");
  const [isSpellcheckEnabled, setIsSpellcheckEnabled] = useState(true);
  const [pasteImagesAsHtml, setPasteImagesAsHtml] = useState(false);
  const [showArchivedGists, setShowArchivedGists] = useState(true);
  const [showStarredGists, setShowStarredGists] = useState(true);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(true);

  const [recentlyViewedGistFiles, setRecentlyViewedGistFiles] = useState<
    RecentlyViewedGistFile[]
  >([]);
  const [showInlineComments, setShowInlineComments] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pinnedGists, setPinnedGists] = useState<string[]>([]);
  const [tags, setTags] = useState<Record<string, TagData>>({});
  const [gistTags, setGistTags] = useState<Record<string, string[]>>({});
  const [globalFrontMatter, setGlobalFrontMatter] =
    useState<string>(DEFAULT_FRONTMATTER);
  const [researchTasks, _setResearchTasks] = useState<ResearchTask[]>([]);

  const [selectedGist, setSelectedGist] = useAtom(selectedGistAtom);
  const selectedGistFile = useAtomValue(selectedGistFileAtom);

  const navigate = useNavigate();
  const { gistId, filePath } = useParams();
  const [searchParams] = useSearchParams();

  // Check if we're in development mode
  const isDevMode = import.meta.env.VITE_DEV_MODE === "true";
  const devUserName = import.meta.env.VITE_DEV_USER_NAME;
  const devUserAvatar = import.meta.env.VITE_DEV_USER_AVATAR;
  const devUserId = import.meta.env.VITE_DEV_USER_ID;

  // Handle login and logout
  useEffect(() => {
    // If in development mode, create a mock user session
    if (isDevMode && devUserName) {
      // Create a mock user profile that matches the Supabase User type
      const mockUser = {
        id: devUserId || "dev-user-id",
        app_metadata: {},
        user_metadata: {
          user_name: devUserName,
          avatar_url:
            devUserAvatar ||
            `https://avatars.githubusercontent.com/u/${devUserId || "0"}?v=4`,
          name: devUserName,
          isAutoSaveEnabled: true,
          showDiffs: false,
          showFrontmatter: false,
          showLineNumbers: false,
          editorTheme: "GitHub",
          isSpellcheckEnabled: true,
          pasteImagesAsHtml: false,
          showArchivedGists: true,
          showStarredGists: true,
          showFormattingToolbar: true,
          recentlyViewedGistFiles: [],
          showInlineComments: true,
          pinnedGists: [],
          tags: {},
          gistTags: {},
          globalFrontMatter: "",
        },
        aud: "authenticated",
        created_at: new Date().toISOString(),
        email: `${devUserName}@example.com`,
        role: "authenticated",
      } as unknown as User;

      // Set user state
      setUser(mockUser);

      // Set user profile
      setUserProfile({
        login: devUserName,
        avatar_url:
          devUserAvatar ||
          `https://avatars.githubusercontent.com/u/${devUserId || "0"}?v=4`,
        initial: devUserName[0].toUpperCase(),
      });

      // Set user preferences
      setIsAutoSaveEnabled(true);
      setShowDiffs(false);
      setShowFrontmatter(false);
      setShowLineNumbers(false);
      _setEditorTheme("GitHub");
      setIsSpellcheckEnabled(true);
      setPasteImagesAsHtml(false);
      setShowArchivedGists(false);
      setShowStarredGists(true);
      setShowFormattingToolbar(true);
      setRecentlyViewedGistFiles([]);
      setShowInlineComments(true);
      setTags({});
      setGistTags({});

      // Store GitHub token from env in localStorage for API calls
      if (import.meta.env.VITE_GITHUB_TOKEN) {
        window.localStorage.setItem(
          TOKEN_CACHE_KEY,
          import.meta.env.VITE_GITHUB_TOKEN
        );
      }

      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(TOKEN_CACHE_KEY);

        setSelectedGist(null);
        navigate("/");

        setUser(null);
        setUserProfile(null);
      } else if (session?.provider_token) {
        localStorage.setItem(TOKEN_CACHE_KEY, session.provider_token);
      }
    });

    // Normal authentication flow for production
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Supabase will return a cached version of the user metadata
      // and so in order to get the latest profile, we need to explicitly fetch it.
      if (session?.user) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user?.user_metadata) {
            setIsAutoSaveEnabled(user.user_metadata.isAutoSaveEnabled ?? true);
            setShowDiffs(user.user_metadata.showDiffs ?? false);
            setShowFrontmatter(user.user_metadata.showFrontmatter ?? false);
            setShowLineNumbers(user.user_metadata.showLineNumbers ?? false);
            _setEditorTheme(user.user_metadata.editorTheme ?? "GitHub");
            setIsSpellcheckEnabled(
              user.user_metadata.isSpellcheckEnabled ?? true
            );
            setPasteImagesAsHtml(user.user_metadata.pasteImagesAsHtml ?? false);
            setShowArchivedGists(user.user_metadata.showArchivedGists ?? true);
            setShowStarredGists(user.user_metadata.showStarredGists ?? true);
            setShowFormattingToolbar(
              user.user_metadata.showFormattingToolbar ?? true
            );
            setRecentlyViewedGistFiles(
              user.user_metadata.recentlyViewedGistFiles ?? []
            );
            setShowInlineComments(
              user.user_metadata.showInlineComments ?? true
            );
            setPinnedGists(user.user_metadata.pinnedGists ?? []);
            setTags(user.user_metadata.tags ?? {});
            setGistTags(user.user_metadata.gistTags ?? {});
            setGlobalFrontMatter(
              user.user_metadata.globalFrontMatter ?? DEFAULT_FRONTMATTER
            );
            _setResearchTasks(user.user_metadata.researchTasks ?? []);
          }

          setUser(session?.user ?? null);
          setUserProfile({
            login: session?.user.user_metadata.user_name,
            avatar_url: user.user_metadata.avatar_url,
            initial: user.user_metadata.name
              ? user.user_metadata.name[0].toUpperCase()
              : user.email
                ? user.email[0].toUpperCase()
                : "A",
          });
        });

        // Check to see whether the user was redirected after signing in
        const redirectData = sessionStorage.getItem("gistpad-auth-redirect");
        if (!redirectData) return;

        const { url, timestamp } = JSON.parse(redirectData);
        sessionStorage.removeItem("gistpad-auth-redirect");

        const age = Date.now() - timestamp;
        if (age < 60000) {
          navigate(url);
        }
      } else {
        // Handle storing redirect URL when user is not logged in
        // First check if we have a gist ID in the URL params
        if (gistId) {
          let url = `/${gistId}`;
          if (filePath && filePath !== "README.md") {
            url += `/${filePath}`;
          }

          // Add any query parameters
          const params = searchParams.toString();
          const queryString = params ? `?${params}` : "";
          url += queryString;

          sessionStorage.setItem(
            "gistpad-auth-redirect",
            JSON.stringify({
              url,
              timestamp: Date.now(),
            })
          );
        }
        // If there's no gist ID in URL but we have a selected gist, use that
        else if (selectedGist?.id) {
          let url = `/${selectedGist.id}`;
          if (selectedGistFile && selectedGistFile !== "README.md") {
            url += `/${selectedGistFile}`;
          }

          // Add any query parameters
          const params = searchParams.toString();
          const queryString = params ? `?${params}` : "";
          url += queryString;

          sessionStorage.setItem(
            "gistpad-auth-redirect",
            JSON.stringify({
              url,
              timestamp: Date.now(),
            })
          );
        }
      }
    });

    const apiKey = localStorage.getItem("gistpad-openai-key");
    setIsAiEnabled(!!apiKey);

    return () => subscription.unsubscribe();
  }, []);

  const updateUserMetadata = async (metadata: UserMetadata) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: metadata,
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error updating user metadata:", error);
    }
  };

  function toggleAutoSave() {
    const enabled = !isAutoSaveEnabled;
    setIsAutoSaveEnabled(enabled);
    updateUserMetadata({ isAutoSaveEnabled: enabled });
  }

  function toggleDiffs() {
    const enabled = !showDiffs;
    setShowDiffs(enabled);
    updateUserMetadata({ showDiffs: enabled });
  }

  function toggleFrontmatter() {
    const enabled = !showFrontmatter;
    setShowFrontmatter(enabled);
    updateUserMetadata({ showFrontmatter: enabled });
  }

  function toggleLineNumbers() {
    const enabled = !showLineNumbers;
    setShowLineNumbers(enabled);
    updateUserMetadata({ showLineNumbers: enabled });
  }

  function toggleSpellcheck() {
    const enabled = !isSpellcheckEnabled;
    setIsSpellcheckEnabled(enabled);
    updateUserMetadata({ isSpellcheckEnabled: enabled });
  }

  function togglePasteImagesAsHtml() {
    const enabled = !pasteImagesAsHtml;
    setPasteImagesAsHtml(enabled);
    updateUserMetadata({ pasteImagesAsHtml: enabled });
  }

  function toggleArchivedGists() {
    const enabled = !showArchivedGists;
    setShowArchivedGists(enabled);
    updateUserMetadata({ showArchivedGists: enabled });
  }

  function toggleStarredGists() {
    const enabled = !showStarredGists;
    setShowStarredGists(enabled);
    updateUserMetadata({ showStarredGists: enabled });
  }

  function toggleInlineComments() {
    const enabled = !showInlineComments;
    setShowInlineComments(enabled);
    updateUserMetadata({ showInlineComments: enabled });
  }

  function toggleFormattingToolbar() {
    const enabled = !showFormattingToolbar;
    setShowFormattingToolbar(enabled);
    updateUserMetadata({ showFormattingToolbar: enabled });
  }

  function pinGist(gistId: string) {
    if (pinnedGists.includes(gistId)) return; // Already pinned

    const newPinnedGists = [...pinnedGists, gistId];
    setPinnedGists(newPinnedGists);
    updateUserMetadata({ pinnedGists: newPinnedGists });
  }

  function unpinGist(gistId: string) {
    if (!pinnedGists.includes(gistId)) return; // Not pinned

    const newPinnedGists = pinnedGists.filter((id) => id !== gistId);
    setPinnedGists(newPinnedGists);
    updateUserMetadata({ pinnedGists: newPinnedGists });
  }

  function addTags(newEntries: TagData[]): void {
    if (newEntries.length === 0) return;

    const newTags = { ...tags };
    for (const entry of newEntries) {
      const id = crypto.randomUUID();
      newTags[id] = { name: entry.name, color: entry.color };
    }

    setTags(newTags);
    updateUserMetadata({ tags: newTags });
  }

  function renameTag(id: string, name: string, color: string) {
    if (!tags[id]) return;
    const newTags = { ...tags, [id]: { name, color } };
    setTags(newTags);
    updateUserMetadata({ tags: newTags });
  }

  function deleteTag(id: string) {
    if (!tags[id]) return;
    const { [id]: _, ...rest } = tags;
    const updatedTags = rest;
    setTags(updatedTags);

    const newGistTags: Record<string, string[]> = {};
    for (const [gid, tagIds] of Object.entries(gistTags)) {
      const filtered = tagIds.filter((t) => t !== id);
      if (filtered.length) newGistTags[gid] = filtered;
    }
    setGistTags(newGistTags);

    updateUserMetadata({ tags: updatedTags, gistTags: newGistTags });
  }

  function setTagsForGist(gistId: string, tagIds: string[]) {
    const newMap = { ...gistTags, [gistId]: tagIds };
    setGistTags(newMap);
    updateUserMetadata({ gistTags: newMap });
  }

  function setEditorTheme(theme: string) {
    _setEditorTheme(theme);
    updateUserMetadata({ editorTheme: theme });
  }

  function setAiConfig(
    apiKey: string,
    askModel: string,
    editModel: string,
    reviewModel: string,
    researchModel: string,
    showReasoningSummaries: boolean
  ) {
    if (apiKey) {
      localStorage.setItem("gistpad-openai-key", apiKey);
    } else {
      localStorage.removeItem("gistpad-openai-key");
    }

    if (askModel) {
      localStorage.setItem("gistpad-openai-ask-model", askModel);
    }

    if (editModel) {
      localStorage.setItem("gistpad-openai-edit-model", editModel);
    }

    if (reviewModel) {
      localStorage.setItem("gistpad-openai-review-model", reviewModel);
    }

    if (researchModel) {
      localStorage.setItem("gistpad-openai-research-model", researchModel);
    }

    if (showReasoningSummaries) {
      localStorage.setItem("gistpad-show-reasoning-summaries", "true");
    } else {
      localStorage.removeItem("gistpad-show-reasoning-summaries");
    }

    setIsAiEnabled(!!apiKey);
  }

  // Manage the recently viewed files list

  function addGistFileToRecentlyViewed(
    gist: {
      id: string;
      description?: string;
      owner?: { login?: string; id: number };
      files: Record<string, any>;
    },
    filename: string
  ) {
    const gistId = gist.id;
    const ownerLogin = gist.owner?.login || "unknown";
    const ownerId = gist.owner.id || 0;

    // Get a proper description for the gist
    const gistDescription = gist.description || filename.replace(/\.md$/, "");

    // Get current timestamp
    const viewedDate = new Date().toISOString();

    // Create the new gist file entry
    const newGistFile: RecentlyViewedGistFile = {
      id: gistId,
      description: gistDescription,
      owner: ownerLogin,
      ownerId: ownerId,
      filename: filename,
      viewedDate,
    };

    // Update the recently viewed list
    setRecentlyViewedGistFiles((prevFiles) => {
      // Check if this gist file is already in the list
      const existingIndex = prevFiles.findIndex(
        (item) => item.id === gistId && item.filename === filename
      );

      let newFiles;

      if (existingIndex !== -1) {
        // If it exists, remove it and update the viewedDate
        const updatedFiles = [...prevFiles];
        updatedFiles.splice(existingIndex, 1);
        newFiles = [newGistFile, ...updatedFiles];
      } else {
        // If it's not in the list, just add it to the front
        newFiles = [newGistFile, ...prevFiles];
      }

      // Limit to 5 items
      const limitedFiles = newFiles.slice(0, 5);
      updateUserMetadata({ recentlyViewedGistFiles: limitedFiles });
      return limitedFiles;
    });
  }

  function removeGistFilesFromRecentlyViewed(gistId: string) {
    setRecentlyViewedGistFiles((prevFiles) => {
      const newFiles = prevFiles.filter((item) => item.id !== gistId);
      updateUserMetadata({ recentlyViewedGistFiles: newFiles });
      return newFiles;
    });
  }

  function clearRecentlyViewedFiles() {
    setRecentlyViewedGistFiles([]);
    updateUserMetadata({ recentlyViewedGistFiles: [] });
  }

  async function signin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "gist",
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("Failed to sign in with GitHub:", error);
    }
  }

  function markResearchTaskAsSeen(id: string) {
    const tasks = researchTasks.map((t) =>
      t.id === id ? { ...t, hasBeenSeen: true } : t
    );
    _setResearchTasks(tasks);
    updateUserMetadata({ researchTasks: tasks });
  }

  function startResearchTask(
    id: string,
    gistId: string | undefined,
    topic: string
  ) {
    const newTask: ResearchTask = {
      id,
      topic,
      startedTime: new Date().toISOString(),
    };
    if (gistId) {
      newTask.gistId = gistId;
    }
    const tasks = [...researchTasks, newTask];
    _setResearchTasks(tasks);
    updateUserMetadata({ researchTasks: tasks });
  }

  function completeResearchTask(
    id: string,
    title: string,
    filename: string,
    content: string
  ) {
    const tasks = researchTasks.map((t) =>
      t.id === id
        ? {
          ...t,
          title,
          filename,
          content,
          completedTime: new Date().toISOString(),
          hasBeenSeen: false,
        }
        : t
    );
    _setResearchTasks(tasks);
    updateUserMetadata({ researchTasks: tasks });
  }

  function deleteResearchTask(id: string) {
    const tasks = researchTasks.filter((t) => t.id !== id);
    _setResearchTasks(tasks);
    updateUserMetadata({ researchTasks: tasks });
  }

  function getGlobalFrontMatter() {
    try {
      return globalFrontMatter ? JSON.parse(globalFrontMatter) : {};
    } catch (e) {
      console.error("Error parsing global front matter:", e);
      return {};
    }
  }

  function updateGlobalFrontMatter(frontMatter: Record<string, any>) {
    try {
      const frontMatterString = JSON.stringify(frontMatter);
      setGlobalFrontMatter(frontMatterString);
      updateUserMetadata({ globalFrontMatter: frontMatterString });
    } catch (e) {
      console.error("Error updating global front matter:", e);
    }
  }

  return {
    // Session management
    isLoggedIn: !!user,
    signin,
    signout: () => supabase.auth.signOut(),
    user: userProfile,
    // User preferences
    isAutoSaveEnabled,
    showDiffs,
    showFrontmatter,
    showLineNumbers,
    editorTheme,
    isAiEnabled,
    isSpellcheckEnabled,
    pasteImagesAsHtml,
    showArchivedGists,
    showStarredGists,
    showFormattingToolbar,
    recentlyViewedGistFiles,
    showInlineComments,
    researchTasks,
    pinnedGists,
    tags,
    gistTags,
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
    clearRecentlyViewedGistFiles: clearRecentlyViewedFiles,
    startResearchTask,
    completeResearchTask,
    deleteResearchTask,
    markResearchTaskAsSeen,
    pinGist,
    unpinGist,
    addTags,
    renameTag,
    deleteTag,
    setTagsForGist,
    getGlobalFrontMatter,
    updateGlobalFrontMatter,
  };
}
