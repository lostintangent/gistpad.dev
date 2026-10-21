const TOKEN_KEY = "gistpad-github-token";

/** Persist GitHub's token separately: Supabase only supplies it when signing in. */
export const githubToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};
