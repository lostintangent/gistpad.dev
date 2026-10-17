import { tool } from "@openai/agents";
import { z } from "zod";

/** Tools that let the AI read the user's other gists, when they're relevant to a request. */
export function createGistTools({
  listGists,
  readGist,
}: {
  listGists: () => { id: string; name: string | null }[];
  readGist: (gistId: string) => Promise<string>;
}) {
  return [
    tool({
      name: "list_gists",
      description:
        "List all of the user's gists (documents/notes), which may provide relevant context to the current conversation",
      parameters: z.object({}),
      execute: listGists,
    }),
    tool({
      name: "read_gist",
      description:
        "Read the contents of a gist, which may provide relevant context to the current conversation",
      parameters: z.object({ gistId: z.string() }),
      execute: ({ gistId }) => readGist(gistId),
    }),
  ];
}
