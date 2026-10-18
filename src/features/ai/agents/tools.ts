import { readFile, readGists } from "@/features/gists/queries";
import { tool } from "@openai/agents";
import { z } from "zod";

/** Tools that let the AI read the user's other gists, when they're relevant to a request. */
export const gistTools = [
  tool({
    name: "list_gists",
    description:
      "List all of the user's gists (documents/notes), which may provide relevant context to the current conversation",
    parameters: z.object({}),
    execute: async () =>
      (await readGists()).map(({ description, id }) => ({ name: description, id })),
  }),
  tool({
    name: "read_gist",
    description:
      "Read the contents of a gist, which may provide relevant context to the current conversation",
    parameters: z.object({ gistId: z.string() }),
    execute: ({ gistId }) => readFile(gistId),
  }),
];
