import { generateDateFilename, getMostRecentDatedFilename } from "@/shared/dates";

// Types

interface GistOwner {
  id: number;
  login: string;
  avatar_url: string;
}

interface GistFile {
  filename: string;
  /** Not included when listing gists (only when fetching an individual gist). */
  content?: string;
  language?: string | null;
}

export interface Gist {
  id: string;
  description: string | null;
  files: Record<string, GistFile>;
  updated_at: string;
  created_at: string;
  public: boolean;
  owner?: GistOwner;
  comments: number;
  history?: GistRevision[];
}

export interface GistComment {
  id: number;
  body: string;
  user: GistOwner | null;
  created_at: string;
  updated_at: string;
}

export interface GistRevision {
  version: string;
  user: GistOwner;
  committed_at: string;
  change_status: {
    total: number;
    additions: number;
    deletions: number;
  };
  url: string;
}

// Auth token

const TOKEN_KEY = "gistpad-github-token";

export const githubToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Requests

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const API_URL = "https://api.github.com";

async function send(url: string, method = "GET", body?: unknown) {
  const token = githubToken.get();
  const response = await fetch(url, {
    method,
    // TanStack Query is the app's cache, so always revalidate with GitHub
    // (which is cheap, since unchanged resources return a 304).
    cache: "no-cache",
    headers: {
      Accept: "application/vnd.github+json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new GitHubError(response.status, `GitHub request failed: ${method} ${url}`);
  }

  return response;
}

async function request<T>(path: string, method?: string, body?: unknown): Promise<T> {
  const response = await send(`${API_URL}${path}`, method, body);
  return response.status === 204 ? (undefined as T) : response.json();
}

/** Fetches every page of a paginated collection, by following the `Link` header. */
async function requestAll<T>(path: string) {
  const items: T[] = [];
  let url: string | undefined = `${API_URL}${path}`;

  while (url) {
    const response = await send(url);
    items.push(...(await response.json()));
    url = response.headers.get("Link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
  }

  return items;
}

// Gist helpers

const DAILY_NOTES_DESCRIPTION = "📆 Daily notes";
const ARCHIVED_SUFFIX = /\s*\[Archived\]$/;

export const TEMPLATE_FILENAME = "template.md";

// Gist files can't be empty, so empty files are saved with an "invisible plus" character.
export const EMPTY_CONTENT = "\u{2064}";

export function isEmptyContent(content: string) {
  return content === EMPTY_CONTENT || content.trim() === "";
}

export function isDailyNote(gist: Gist) {
  return gist.description === DAILY_NOTES_DESCRIPTION;
}

export function isArchived(gist: Gist) {
  return ARCHIVED_SUFFIX.test(gist.description ?? "");
}

/** The gist's description, without any internal markers (e.g. the archived suffix). */
export function getGistDescription(gist: Gist) {
  return (gist.description ?? "").replace(ARCHIVED_SUFFIX, "");
}

export function getGistDisplayName(gist: Gist) {
  const displayName = getGistDescription(gist) || Object.keys(gist.files)[0]?.replace(/\.md$/, "");

  if (!displayName) return "Empty";
  return displayName === "README" ? "Untitled" : displayName;
}

export function getDefaultFile(gist: Gist) {
  const filenames = Object.keys(gist.files);
  return (
    getMostRecentDatedFilename(filenames.filter((f) => f.endsWith(".md"))) ??
    (gist.files["README.md"] ? "README.md" : (filenames[0] ?? "README.md"))
  );
}

export function getTodayNoteFilename() {
  return `${generateDateFilename("YYYY-MM-DD")}.md`;
}

function isMarkdownGist(gist: Gist, { allowImages = false } = {}) {
  return Object.values(gist.files).every(
    (file) =>
      file.language === "Markdown" ||
      file.filename.endsWith(".tldraw") ||
      (allowImages && file.filename.endsWith(".png")),
  );
}

const byMostRecentlyUpdated = (a: Gist, b: Gist) =>
  Date.parse(b.updated_at) - Date.parse(a.updated_at);

// Gists

/** All of the user's markdown gists (including archived gists and daily notes), most recent first. */
export async function listGists() {
  const gists = await requestAll<Gist>("/gists?per_page=100");
  return gists
    .filter((gist) => isMarkdownGist(gist, { allowImages: true }))
    .sort(byMostRecentlyUpdated);
}

export async function listStarredGists() {
  const gists = await requestAll<Gist>("/gists/starred?per_page=100");
  return gists.filter((gist) => isMarkdownGist(gist)).sort(byMostRecentlyUpdated);
}

export function getGist(gistId: string) {
  return request<Gist>(`/gists/${gistId}`);
}

export function createGist({
  description = "",
  content,
  filename = "README.md",
  isPublic = false,
}: {
  description?: string;
  content?: string;
  filename?: string;
  isPublic?: boolean;
}) {
  return request<Gist>("/gists", "POST", {
    description,
    public: isPublic,
    files: {
      [filename]: {
        content: content || (description ? `# ${description}\n\n` : EMPTY_CONTENT),
      },
    },
  });
}

export function deleteGist(gistId: string) {
  return request<void>(`/gists/${gistId}`, "DELETE");
}

type FileChange = { content: string } | { filename: string } | null;

function updateGist(
  gistId: string,
  changes: { description?: string; files?: Record<string, FileChange> },
) {
  return request<Gist>(`/gists/${gistId}`, "PATCH", changes);
}

/** Updates a gist's description (while preserving whether it's archived). */
export function updateGistDescription(gist: Gist, description: string) {
  return updateGist(gist.id, {
    description: isArchived(gist) ? `${description.trim()} [Archived]` : description,
  });
}

export function saveGistFiles(gistId: string, files: { filename: string; content: string }[]) {
  return updateGist(gistId, {
    files: Object.fromEntries(
      files.map(({ filename, content }) => [filename, { content: content || EMPTY_CONTENT }]),
    ),
  });
}

export function addGistFile(
  gistId: string,
  filename: string,
  content = `# ${filename.replace(/\.md$/, "")}\n\n`,
) {
  return updateGist(gistId, { files: { [filename]: { content } } });
}

export function renameGistFile(gistId: string, filename: string, newFilename: string) {
  return updateGist(gistId, { files: { [filename]: { filename: newFilename } } });
}

export function deleteGistFile(gistId: string, filename: string) {
  return updateGist(gistId, { files: { [filename]: null } });
}

export function archiveGist(gist: Gist) {
  return updateGist(gist.id, { description: `${getGistDisplayName(gist).trim()} [Archived]` });
}

export function unarchiveGist(gist: Gist) {
  return updateGist(gist.id, { description: getGistDescription(gist) });
}

export async function duplicateGist(gistId: string) {
  const gist = await getGist(gistId);
  return request<Gist>("/gists", "POST", {
    description: `${getGistDisplayName(gist)} (Copy)`,
    files: gist.files,
    public: false,
  });
}

export function forkGist(gistId: string) {
  return request<Gist>(`/gists/${gistId}/forks`, "POST");
}

export function starGist(gistId: string) {
  return request<void>(`/gists/${gistId}/star`, "PUT");
}

export function unstarGist(gistId: string) {
  return request<void>(`/gists/${gistId}/star`, "DELETE");
}

// Daily notes

/** Adds today's note to the daily notes gist (creating the gist if needed), based on its template. */
export function createDailyNote(dailyNotes: Gist | undefined) {
  const date = generateDateFilename("YYYY-MM-DD");
  const filename = getTodayNoteFilename();
  const template = dailyNotes?.files[TEMPLATE_FILENAME]?.content;
  const content = template ? template.replace(/\{\{date\}\}/g, date) : `# ${date}\n\n`;

  return dailyNotes
    ? addGistFile(dailyNotes.id, filename, content)
    : createGist({ description: DAILY_NOTES_DESCRIPTION, filename, content });
}

// Comments

export function listGistComments(gistId: string) {
  return requestAll<GistComment>(`/gists/${gistId}/comments?per_page=100`);
}

export function createGistComment(gistId: string, body: string) {
  return request<GistComment>(`/gists/${gistId}/comments`, "POST", { body });
}

export function updateGistComment(gistId: string, commentId: number, body: string) {
  return request<GistComment>(`/gists/${gistId}/comments/${commentId}`, "PATCH", { body });
}

export function deleteGistComment(gistId: string, commentId: number) {
  return request<void>(`/gists/${gistId}/comments/${commentId}`, "DELETE");
}

// Revisions

export function listGistRevisions(gistId: string) {
  return request<GistRevision[]>(`/gists/${gistId}/commits?per_page=20`);
}

export function getGistRevision(gistId: string, revisionId: string) {
  return request<Gist>(`/gists/${gistId}/${revisionId}`);
}

// Users

export function getAuthenticatedUser() {
  return request<GistOwner & { name: string | null }>("/user");
}
