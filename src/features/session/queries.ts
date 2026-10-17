import { getAuthenticatedUser, githubToken, type Gist } from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import { auth } from "@/shared/supabase";
import { isAuthRetryableFetchError } from "@supabase/auth-js";
import type { FrontMatter } from "@/shared/frontMatter";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

// Types

export interface User {
  login: string;
  avatarUrl: string;
  initial: string;
}

export interface RecentlyViewedGistFile {
  id: string;
  description: string;
  owner: string;
  ownerId: number;
  filename: string;
  viewedDate: string;
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

// Note: These are persisted as the user's Supabase metadata, so they
// need to remain backwards compatible with previously saved values.
export interface Preferences {
  isAutoSaveEnabled: boolean;
  showDiffs: boolean;
  showFrontmatter: boolean;
  editorTheme: string;
  showLineNumbers: boolean;
  isSpellcheckEnabled: boolean;
  pasteImagesAsHtml: boolean;
  showArchivedGists: boolean;
  showStarredGists: boolean;
  showInlineComments: boolean;
  showFormattingToolbar: boolean;
  recentlyViewedGistFiles: RecentlyViewedGistFile[];
  pinnedGists: string[];
  tags: Record<string, TagData>;
  gistTags: Record<string, string[]>;
  /** A JSON-serialized object of global AI settings (e.g. custom commands). */
  globalFrontMatter: string;
  researchTasks: ResearchTask[];
}

export interface Session {
  user: User;
  preferences: Preferences;
}

const DEFAULT_PREFERENCES: Preferences = {
  isAutoSaveEnabled: true,
  showDiffs: false,
  showFrontmatter: false,
  editorTheme: "GitHub",
  showLineNumbers: false,
  isSpellcheckEnabled: true,
  pasteImagesAsHtml: false,
  showArchivedGists: true,
  showStarredGists: true,
  showInlineComments: true,
  showFormattingToolbar: true,
  recentlyViewedGistFiles: [],
  pinnedGists: [],
  tags: {},
  gistTags: {},
  globalFrontMatter: JSON.stringify({
    edit: {
      commands: {
        fix: "Fix any issues in this document, such as typos, grammar errors, or formatting problems.",
        improve:
          "Improve the quality of this document, such as enhancing clarity, conciseness, or completeness.",
        expand: "Expand on the content of this document, adding more details or examples.",
      },
    },
    discuss: {
      commands: {
        clarity: "Provide suggestions for improving the clarity of this document.",
        conciseness: "Provide suggestions for making this document more concise.",
        completeness: "Provide suggestions for making this document more complete.",
      },
    },
  }),
  researchTasks: [],
};

// Session sources

interface SessionSource {
  load(): Promise<Session | null>;
  savePreferences(changes: Partial<Preferences>): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const AUTH_REDIRECT_KEY = "gistpad-auth-redirect";

/** The default source, which signs users in with GitHub (via Supabase). */
const supabaseSource: SessionSource = {
  async load() {
    const { data } = await auth.getSession();
    if (!data.session) {
      githubToken.clear();
      return null;
    }

    // The session includes a cached copy of the user's metadata,
    // so explicitly fetch the user in order to get their latest preferences.
    const {
      data: { user },
      error,
    } = await auth.getUser();
    // (A network error doesn't mean the user is signed out, so let the query retry)
    if (isAuthRetryableFetchError(error)) throw error;
    if (!user) return null;

    const { user_name, avatar_url, name, ...preferences } = user.user_metadata;
    return {
      user: {
        login: user_name,
        avatarUrl: avatar_url,
        initial: (name || user.email || "A")[0].toUpperCase(),
      },
      preferences: { ...DEFAULT_PREFERENCES, ...preferences },
    };
  },

  async savePreferences(changes) {
    const { error } = await auth.updateUser({ data: changes });
    if (error) throw error;
  },

  async signIn() {
    // Remember where the user was, so they can return there after signing in.
    sessionStorage.setItem(
      AUTH_REDIRECT_KEY,
      JSON.stringify({ url: location.hash, timestamp: Date.now() }),
    );

    await auth.signInWithOAuth({
      provider: "github",
      options: { scopes: "gist", redirectTo: location.origin },
    });
  },

  async signOut() {
    await auth.signOut();
  },
};

const LOCAL_PREFERENCES_KEY = "gistpad-local-preferences";

/** A dev server source, which signs in using a GitHub token from `.env.local`. */
const localSource = (token: string): SessionSource => ({
  async load() {
    githubToken.set(token);
    const user = await getAuthenticatedUser();
    const preferences = JSON.parse(localStorage.getItem(LOCAL_PREFERENCES_KEY) ?? "{}");

    return {
      user: {
        login: user.login,
        avatarUrl: user.avatar_url,
        initial: (user.name || user.login)[0].toUpperCase(),
      },
      preferences: { ...DEFAULT_PREFERENCES, ...preferences },
    };
  },

  async savePreferences(changes) {
    const preferences = JSON.parse(localStorage.getItem(LOCAL_PREFERENCES_KEY) ?? "{}");
    localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify({ ...preferences, ...changes }));
  },

  async signIn() {},
  async signOut() {},
});

const localToken = process.env.BUN_PUBLIC_GITHUB_TOKEN;
const source = localToken ? localSource(localToken) : supabaseSource;

/**
 * Completes a GitHub sign-in redirect (if there is one), and returns the
 * app path that the user was on when they started signing in.
 */
export async function completeSignIn(): Promise<string | undefined> {
  // Supabase returns the sign-in result as `#access_token=...` (or `#error=...`), which would
  // otherwise be mistaken for an app route. So let Supabase process it before routing.
  if (!/^#(access_token|error)=/.test(location.hash)) return;
  await auth.getSession();

  // The cache may include a session from before the user signed in (i.e. a signed-out one)
  queryClient.removeQueries({ queryKey: sessionQuery.queryKey });

  const redirect = sessionStorage.getItem(AUTH_REDIRECT_KEY);
  sessionStorage.removeItem(AUTH_REDIRECT_KEY);

  const { url = "", timestamp = 0 } = redirect ? JSON.parse(redirect) : {};
  const isRecent = Date.now() - timestamp < 1000 * 60 * 5;
  return (isRecent && url.replace(/^#/, "")) || "/";
}

// Queries

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => source.load(),
  staleTime: 1000 * 60 * 5,
});

auth.onAuthStateChange((event, session) => {
  // GitHub's token is only provided when the user first signs in, so we need to hold onto it.
  if (session?.provider_token) {
    githubToken.set(session.provider_token);
  }

  if (event === "SIGNED_OUT") {
    githubToken.clear();

    // Sign the user out of the app first (which unmounts their gists), and then clear their data
    queryClient.setQueryData(sessionQuery.queryKey, null);
    queryClient.removeQueries({
      predicate: ({ queryKey }) => queryKey[0] !== sessionQuery.queryKey[0],
    });
  }
});

export function useSession() {
  const { data: session } = useQuery(sessionQuery);
  return { session, user: session?.user };
}

export const signIn = () => source.signIn();
export const signOut = () => source.signOut();

// Preferences

export function usePreferences(): Preferences {
  const { data } = useQuery({ ...sessionQuery, select: (session) => session?.preferences });
  return data ?? DEFAULT_PREFERENCES;
}

type PreferencesUpdate =
  Partial<Preferences> | ((preferences: Preferences) => Partial<Preferences>);

/** Updates the user's preferences, optimistically applying them to the session cache. */
export function useUpdatePreferences() {
  const { mutate } = useMutation({
    mutationFn: (changes: Partial<Preferences>) => source.savePreferences(changes),
    onError: () => queryClient.invalidateQueries(sessionQuery),
    meta: { errorMessage: "Failed to save your settings" },
  });

  return (update: PreferencesUpdate) => {
    const session = queryClient.getQueryData(sessionQuery.queryKey);
    if (!session) return;

    // (So that an in-flight refetch doesn't overwrite the update)
    queryClient.cancelQueries(sessionQuery);

    const changes = typeof update === "function" ? update(session.preferences) : update;
    queryClient.setQueryData(
      sessionQuery.queryKey,
      (session) => session && { ...session, preferences: { ...session.preferences, ...changes } },
    );

    mutate(changes);
  };
}

/** Parses the user's global AI settings (e.g. custom commands). */
export function parseGlobalFrontMatter(preferences: Preferences): FrontMatter {
  try {
    return JSON.parse(preferences.globalFrontMatter) ?? {};
  } catch {
    return {};
  }
}

/** Records that the user viewed someone else's gist file, so it shows up in their recent files. */
export function useRecordRecentlyViewed() {
  const updatePreferences = useUpdatePreferences();
  return (gist: Gist, filename: string) =>
    updatePreferences(({ recentlyViewedGistFiles }) => ({
      recentlyViewedGistFiles: addRecentlyViewedFile(recentlyViewedGistFiles, gist, filename),
    }));
}

/** Moves the gist file to the top of the user's recently viewed list. */
function addRecentlyViewedFile(
  files: RecentlyViewedGistFile[],
  gist: Gist,
  filename: string,
): RecentlyViewedGistFile[] {
  const entry: RecentlyViewedGistFile = {
    id: gist.id,
    description: gist.description || filename.replace(/\.md$/, ""),
    owner: gist.owner?.login ?? "unknown",
    ownerId: gist.owner?.id ?? 0,
    filename,
    viewedDate: new Date().toISOString(),
  };

  return [
    entry,
    ...files.filter((file) => file.id !== gist.id || file.filename !== filename),
  ].slice(0, 5);
}
