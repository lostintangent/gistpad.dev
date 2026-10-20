import { readGist, readGists } from "@/features/gists/queries";
import { getDefaultFile, getGistDisplayName, toMarkdownFilename, type Gist } from "@/shared/github";
import { z } from "zod";
import { defineTool, type AgentTool } from "./tools";

// The tools that let the agent read the user's other gists (when they're relevant to a request), which
// are available in every mode (and to the voice assistant).

// Results are added to the conversation's context, so their size is limited
const MAX_SEARCH_RESULTS = 20;
const MAX_FILES_PER_GIST = 20;

/** Finds the gists whose name (or filenames) include a query's terms, ranked by how many they include. */
function searchGists(gists: Gist[], terms: string[]) {
  return (
    gists
      .map((gist) => {
        const text = [getGistDisplayName(gist), ...Object.keys(gist.files)]
          .join("\n")
          .toLowerCase();
        return { gist, score: terms.filter((term) => text.includes(term)).length };
      })
      .filter(({ score }) => score > 0)
      // Sorting is stable, so equally-ranked gists stay in order (most recently updated first)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SEARCH_RESULTS)
      .map(({ gist }) => gist)
  );
}

/** Describes a gist, including its files that match the query's terms (or all of them, if none do). */
function toResult(gist: Gist, terms: string[]) {
  const filenames = Object.keys(gist.files);
  const matchingFiles = filenames.filter((filename) =>
    terms.some((term) => filename.toLowerCase().includes(term)),
  );
  const files = (matchingFiles.length > 0 ? matchingFiles : filenames).slice(0, MAX_FILES_PER_GIST);

  return {
    id: gist.id,
    name: getGistDisplayName(gist),
    files,
    ...(files.length < filenames.length && { totalFiles: filenames.length }),
  };
}

export const gistTools: AgentTool[] = [
  defineTool({
    name: "list_gists",
    description:
      "Search the user's gists (their documents/notes), which may provide relevant context to the conversation. Prefer searching with a query (a few keywords), which returns the best matches. And only list all of them (with a null query) if searching doesn't find what you're looking for.",
    parameters: z.object({
      query: z
        .string()
        .nullable()
        .describe(
          "Keywords to search the gists' names and filenames for (where a gist matches if it includes any of them), or null to list all of the gists.",
        ),
    }),
    execute: async ({ query }) => {
      const gists = await readGists();
      const terms = query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
      const results = terms.length > 0 ? searchGists(gists, terms) : gists;

      if (results.length === 0) {
        return `No gists matched "${query}". Try different keywords, or list all of the gists (with a null query).`;
      }

      return JSON.stringify(results.map((gist) => toResult(gist, terms)));
    },
  }),
  defineTool({
    name: "read_gist",
    description:
      "Read the contents of a file in one of the user's gists, which may provide relevant context to the conversation.",
    parameters: z.object({
      gistId: z.string(),
      filename: z
        .string()
        .nullable()
        .describe("The file to read (from the gist's files), or null to read its main file."),
    }),
    execute: async ({ gistId, filename }) => {
      const gist = await readGist(gistId);
      const file =
        filename === null
          ? gist.files[getDefaultFile(gist)]
          : (gist.files[filename] ?? gist.files[toMarkdownFilename(filename)]);

      if (!file) {
        const filenames = Object.keys(gist.files).join(", ");
        throw new Error(
          `The gist doesn't have a file named "${filename}". Its files are: ${filenames}`,
        );
      }

      return file.content ?? "";
    },
  }),
];
