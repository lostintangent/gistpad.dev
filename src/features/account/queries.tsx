import { githubToken } from "@/shared/github-token";
import { queryClient } from "@/shared/query-client";
import { auth } from "@/shared/supabase";
import { isAuthRetryableFetchError } from "@supabase/auth-js";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { AUTH_REDIRECT_KEY, getSignInCallback, readSignInRedirect } from "./sign-in-redirect";

// Types

interface RecentlyViewedGistFile {
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

/** A research task (whose results stay with OpenAI, see the research feature). */
export interface ResearchTask {
  id: string;
  gistId?: string;
  topic: string;
  startedTime: string;
  completedTime?: string;
  hasBeenSeen?: boolean;
}

// Note: These are persisted as the user's Supabase metadata, so they need to remain backwards
// compatible with previously saved values. And since that metadata is embedded in the user's access
// token, they need to stay small (a document's worth makes the token too large to send on iOS).
export interface Preferences {
  /** The color of the app's primary actions (e.g. creating a gist). */
  accentColor: string;
  isAutoSaveEnabled: boolean;
  showDiffs: boolean;
  showFrontmatter: boolean;
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
  /** A JSON-serialized object of global agent settings (e.g. custom commands), or empty for the defaults. */
  globalFrontMatter: string;
  researchTasks: ResearchTask[];
}

interface Session {
  user: { login: string; avatarUrl: string; initial: string };
  preferences: Preferences;
}

const DEFAULT_PREFERENCES: Preferences = {
  accentColor: "#facc15",
  isAutoSaveEnabled: true,
  showDiffs: false,
  showFrontmatter: false,
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
  globalFrontMatter: "",
  researchTasks: [],
};

// Authentication

/** GitHub sign-in and account preferences, provided by Supabase. */
async function fetchSession(): Promise<Session | null> {
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
}

async function savePreferences(changes: Partial<Preferences>) {
  const { error } = await auth.updateUser({ data: changes });
  if (error) throw error;
}

export async function signIn() {
  // Remember where the user was, so they can return there after signing in.
  sessionStorage.setItem(
    AUTH_REDIRECT_KEY,
    JSON.stringify({ url: location.hash, timestamp: Date.now() }),
  );

  await auth.signInWithOAuth({
    provider: "github",
    options: { scopes: "gist", redirectTo: location.origin },
  });
}

export async function signOut() {
  await auth.signOut();
}

/**
 * Completes a GitHub sign-in redirect (if there is one), and returns the
 * app path that the user was on when they started signing in.
 */
export async function completeSignIn() {
  // Supabase returns the sign-in result as `#access_token=...` (or `#error=...`), which would
  // otherwise be mistaken for an app route. So let Supabase process it before routing.
  if (!getSignInCallback(location.hash)) return;
  await auth.getSession();

  // The cache may include a session from before the user signed in (i.e. a signed-out one)
  queryClient.removeQueries({ queryKey: sessionQuery.queryKey });

  const redirect = readSignInRedirect();
  try {
    sessionStorage.removeItem(AUTH_REDIRECT_KEY);
  } catch {
    // Storage may be blocked; the redirect reader already falls back to home.
  }
  return redirect;
}

// Queries

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: fetchSession,
  staleTime: 1000 * 60 * 5,
});

/** Loads the user's session (using the cached one when it's available, so returning users don't wait). */
export const loadSession = () => queryClient.query({ ...sessionQuery, staleTime: "static" });

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

// Preferences

export function usePreferences() {
  const { data } = useQuery({ ...sessionQuery, select: (session) => session?.preferences });
  return data ?? DEFAULT_PREFERENCES;
}

/** The number of gists that each tag has been added to. */
export function useTagCounts() {
  const { gistTags } = usePreferences();
  const counts: Partial<Record<string, number>> = {};
  for (const tagId of Object.values(gistTags).flat()) counts[tagId] = (counts[tagId] ?? 0) + 1;
  return counts;
}

/** Updates the user's preferences, optimistically applying them to the session cache. */
export function useUpdatePreferences() {
  const { mutate } = useMutation({
    mutationFn: savePreferences,
    onError: () => queryClient.invalidateQueries(sessionQuery),
    meta: { errorMessage: "Failed to save your settings" },
  });

  return (update: Partial<Preferences> | ((preferences: Preferences) => Partial<Preferences>)) => {
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
