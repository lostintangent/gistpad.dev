// Types
import { getGitHubToken } from "@/hooks/useUserSession";
import { getMostRecentDatedFilename, isDateBasedGist } from "@/lib/utils";
import { format } from "date-fns";

interface GistOwner {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GistFile {
  filename: string;
  content: string;
  language?: string;
}

export interface GistComment {
  id: number;
  body: string;
  user: GistOwner;
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

export interface Gist {
  id: string;
  description: string;
  files: { [key: string]: GistFile };
  updated_at: string;
  created_at: string;
  public: boolean;
  owner?: GistOwner;
  comments: number;
  history?: GistRevision[];
}

export interface GistData {
  gists: Gist[];
  archivedGists: Gist[];
  dailyNotes: Gist | null;
}

// Utilities

const EMPTY_CONTENT = "\u{2064}"; // Invisible plus character

export function isEmptyContent(content: string): boolean {
  return content === EMPTY_CONTENT || content.trim() === "";
}

function parseLinkHeader(header: string | null): { next?: string } {
  if (!header) return {};

  const parts = header.split(",");
  const links: { [key: string]: string } = {};

  for (const part of parts) {
    const section = part.split(";");
    if (section.length !== 2) continue;

    const url = section[0].trim().slice(1, -1);
    const rel = section[1].trim().slice(5, -1);

    links[rel] = url;
  }

  return { next: links["next"] };
}

function gistFetch(
  urlPath: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body: any = null
): Promise<Response> {
  const token = getGitHubToken();
  const headers: HeadersInit = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`https://api.github.com/gists${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function isDailyNote(gist: Gist): boolean {
  return gist.description === DAILY_NOTES_DESCRIPTION;
}

export function getDefaultFile(gist: Gist) {
  if (isDateBasedGist(gist)) {
    const filenames = Object.keys(gist.files).filter((f) => f.endsWith(".md"));
    const recent = getMostRecentDatedFilename(filenames);
    if (recent) return recent;
  }
  return gist.files["README.md"]?.filename || Object.keys(gist.files)[0];
}

export function isArchived(gist: Gist): boolean {
  return gist.description && gist.description.endsWith("[Archived]");
}

export function getGistDisplayName(gist: Gist) {
  const displayName = isArchived(gist)
    ? gist.description.replace(/\s*\[Archived\]$/, "")
    : gist.description || Object.keys(gist.files)[0]?.replace(/\.md$/, "");

  if (!displayName) return "Empty";

  return displayName === "README" ? "Untitled" : displayName;
}

// Gists

const DAILY_NOTES_DESCRIPTION = "📆 Daily notes";
export const TEMPLATE_FILENAME = "template.md";
export async function fetchUserGists(
  forceRefresh: boolean = false
): Promise<{ gists: Gist[]; archivedGists: Gist[]; dailyNotes: Gist | null }> {
  let url = "https://api.github.com/gists?per_page=100";
  const allGists: Gist[] = [];

  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getGitHubToken()}`,
        "If-None-Match": forceRefresh ? "" : undefined,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch gists");
    }

    const gists = await response.json();
    const filteredGists = gists.filter((gist: Gist) => {
      const files = Object.entries(gist.files);
      return files.every(
        ([_, file]) =>
          file.language === "Markdown" ||
          file.filename.endsWith(".tldraw") ||
          file.filename.endsWith(".png")
      );
    });

    allGists.push(...filteredGists);

    const { next } = parseLinkHeader(response.headers.get("Link"));
    url = next || "";
  }

  const sortedGists = allGists.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const dailyNotes =
    sortedGists.find((gist) => gist.description === DAILY_NOTES_DESCRIPTION) ||
    null;
  const filteredGists = dailyNotes
    ? sortedGists.filter((gist) => gist.id !== dailyNotes.id)
    : sortedGists;

  // Split gists into archived and non-archived
  const archivedGists = filteredGists.filter((gist) => isArchived(gist));
  const gists = filteredGists.filter((gist) => !isArchived(gist));

  return {
    gists,
    archivedGists,
    dailyNotes,
  };
}

export async function getGistById(gistId: string): Promise<Gist> {
  const response = await gistFetch(`/${gistId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch gist`);
  }

  return response.json();
}

export async function fetchGistContent(
  gistId: string,
  filename?: string
): Promise<string> {
  const response = await gistFetch(`/${gistId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch gist content");
  }

  const gist = await response.json();

  if (filename) {
    return gist.files[filename]?.content || "";
  }

  return (
    // @ts-ignore
    gist.files["README.md"]?.content || Object.values(gist.files)[0].content
  );
}

export async function updateGistContent(
  gistId: string,
  content: string,
  filename: string = "README.md",
  extraFiles?: GistFile[]
): Promise<Gist> {
  const filesToUpdate: { [key: string]: { content: string } } = {
    [filename]: {
      content: content || EMPTY_CONTENT,
    },
  };

  if (extraFiles) {
    for (const extraFile of extraFiles) {
      filesToUpdate[extraFile.filename] = { content: extraFile.content };
    }
  }

  const response = await gistFetch(`/${gistId}`, "PATCH", {
    files: filesToUpdate,
  });

  if (!response.ok) {
    throw new Error("Failed to update gist");
  }

  return response.json();
}

export async function updateGistDescription(
  gistId: string,
  description: string
): Promise<Gist> {
  const response = await gistFetch(`/${gistId}`, "PATCH", {
    description,
  });

  if (!response.ok) {
    throw new Error("Failed to update gist description");
  }

  return response.json();
}

export async function createGist(
  description: string,
  initialContent?: string,
  isPublic: boolean = false,
  filename: string = "README.md"
): Promise<Gist> {
  const response = await gistFetch("", "POST", {
    description,
    public: isPublic,
    files: {
      [filename]: {
        // Gist files can't be empty, so we're using an "invisible plus"
        // when there's no content or description.
        content:
          initialContent || (description ? `# ${description}\n\n` : EMPTY_CONTENT),
      },
    },
  });

  if (!response.ok) {
    throw new Error("Failed to create gist");
  }

  return response.json();
}

export async function deleteGist(gistId: string): Promise<void> {
  const response = await gistFetch(`/${gistId}`, "DELETE");
  if (!response.ok) {
    throw new Error("Failed to delete gist");
  }
}

export async function deleteGistFile(
  gistId: string,
  filename: string
): Promise<Gist> {
  const response = await gistFetch(`/${gistId}`, "PATCH", {
    files: {
      [filename]: null, // Setting to null deletes the file
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete gist file");
  }

  return response.json();
}

export async function renameGistFile(
  gistId: string,
  oldFilename: string,
  newFilename: string
): Promise<Gist> {
  const response = await gistFetch(`/${gistId}`, "PATCH", {
    files: {
      [oldFilename]: {
        filename: newFilename,
      },
    },
  });

  if (!response.ok) {
    throw new Error("Failed to rename gist file");
  }

  return response.json();
}

export async function addGistFile(
  gistId: string,
  filename: string,
  content: string = "# " + filename.replace(/\.md$/, "") + "\n\n"
): Promise<Gist> {
  const response = await gistFetch(`/${gistId}`, "PATCH", {
    files: {
      [filename]: {
        content,
      },
    },
  });

  if (!response.ok) {
    throw new Error("Failed to add file to gist");
  }

  return response.json();
}

export async function duplicateGist(gistId: string): Promise<Gist> {
  const gist = await getGistById(gistId);

  const description = `${getGistDisplayName(gist)} (Copy)`;
  const response = await gistFetch("", "POST", {
    description,
    files: gist.files,
    public: false,
  });

  if (!response.ok) {
    throw new Error("Failed to duplicate gist");
  }

  return response.json();
}

// Staring/forking

export async function fetchStarredGists(): Promise<Gist[]> {
  let url = "https://api.github.com/gists/starred?per_page=100";
  const allGists: Gist[] = [];

  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getGitHubToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch starred gists");
    }

    const gists = await response.json();
    const filteredGists = gists.filter((gist: Gist) => {
      const files = Object.entries(gist.files);
      return files.every(
        ([_, file]) =>
          file.language === "Markdown" || file.filename.endsWith(".tldraw")
      );
    });

    allGists.push(...filteredGists);

    const { next } = parseLinkHeader(response.headers.get("Link"));
    url = next || "";
  }

  const sortedGists = allGists.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return sortedGists;
}

export async function isGistStarred(gistId: string): Promise<boolean> {
  const response = await gistFetch(`/${gistId}/star`, "GET");
  return response.status === 204;
}

export async function starGist(gistId: string): Promise<void> {
  const response = await gistFetch(`/${gistId}/star`, "PUT");
  if (!response.ok) {
    throw new Error("Failed to star gist");
  }
}

export async function unstarGist(gistId: string): Promise<void> {
  const response = await gistFetch(`/${gistId}/star`, "DELETE");
  if (!response.ok) {
    throw new Error("Failed to unstar gist");
  }
}

export async function forkGist(gistId: string): Promise<Gist> {
  const response = await gistFetch(`/${gistId}/forks`, "POST");
  if (!response.ok) {
    throw new Error("Failed to fork gist");
  }
  return response.json();
}

// Comments

export async function getGistComments(gistId: string): Promise<GistComment[]> {
  // TODO: Paginate these. But for now, most gists have less than 100 comments
  const response = await gistFetch(`/${gistId}/comments?per_page=100`);
  if (!response.ok) {
    throw new Error("Failed to fetch gist comments");
  }

  return response.json();
}

export async function createGistComment(
  gistId: string,
  body: string
): Promise<GistComment> {
  const response = await gistFetch(`/${gistId}/comments`, "POST", { body });
  if (!response.ok) {
    throw new Error("Failed to create comment");
  }

  return response.json();
}

export async function updateGistComment(
  gistId: string,
  commentId: number,
  body: string
): Promise<GistComment> {
  const response = await gistFetch(
    `/${gistId}/comments/${commentId}`,
    "PATCH",
    { body }
  );
  if (!response.ok) {
    throw new Error("Failed to update comment");
  }
  return response.json();
}

export async function deleteGistComment(
  gistId: string,
  commentId: number
): Promise<void> {
  const response = await gistFetch(
    `/${gistId}/comments/${commentId}`,
    "DELETE"
  );
  if (!response.ok) {
    throw new Error("Failed to delete comment");
  }
}

// Revisions

export async function getGistRevisions(
  gistId: string
): Promise<GistRevision[]> {
  const response = await gistFetch(`/${gistId}/commits?per_page=20`);
  if (!response.ok) {
    throw new Error("Failed to fetch gist revisions");
  }

  return response.json();
}

export async function getGistRevisionContent(
  gistId: string,
  revisionId: string
): Promise<Gist> {
  const response = await gistFetch(`/${gistId}/${revisionId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch gist revision");
  }

  return response.json();
}

// Daily notes

// Utility function to get today's note filename
export const getTodayNoteFilename = (): string => {
  return `${format(new Date(), "yyyy-MM-dd")}.md`;
};

export const createOrUpdateDailyNote = async (
  dailyNotes: Gist | null
): Promise<Gist> => {
  // Generate the filename based on current date in yyyy-MM-dd format
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const filename = getTodayNoteFilename();

  // Default content if no template exists
  let noteContent = `# ${dateStr}\n\n`;

  // If dailyNotes exist and has a template.md file, use the template content instead
  if (dailyNotes && dailyNotes.files[TEMPLATE_FILENAME]) {
    // Get the template content
    const templateContent = dailyNotes.files[TEMPLATE_FILENAME].content;

    // Replace {{date}} with the current date in yyyy-MM-DD format
    noteContent = templateContent.replace(/\{\{date\}\}/g, dateStr);
  }

  let updatedGist: Gist;
  if (dailyNotes) {
    updatedGist = await addGistFile(dailyNotes.id, filename, noteContent);
  } else {
    const response = await gistFetch("", "POST", {
      description: DAILY_NOTES_DESCRIPTION,
      public: false,
      files: {
        [filename]: {
          content: noteContent,
        },
      },
    });

    if (!response.ok) {
      throw new Error("Failed to create daily notes gist");
    }

    updatedGist = await response.json();
  }

  return updatedGist;
};

// Archive functions

export async function archiveGist(gist: Gist): Promise<Gist> {
  // Make sure the gist has a description
  const description =
    gist.description || Object.keys(gist.files)[0].replace(/\.md$/, "");
  const newDescription = `${description.trim()} [Archived]`;
  return updateGistDescription(gist.id, newDescription);
}

export async function unarchiveGist(gist: Gist): Promise<Gist> {
  const newDescription = gist.description.replace(/\s*\[Archived\]$/, "");
  return updateGistDescription(gist.id, newDescription);
}
