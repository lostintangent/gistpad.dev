import { readFile, readGists } from "@/features/gists/queries";
import { getGistDisplayName, toMarkdownFilename } from "@/shared/github";
import type { AdditionalReference } from "../openai";
import type { CustomCommand } from "../settings/useAgentSettings";

/** Expands a slash command (e.g. `/summarize briefly`) into its prompt, plus any input that follows it. */
export function expandCustomCommand(command: string, commands: CustomCommand[]) {
  const [, name, input] = command.match(/^\/(\S+)\s*(.*)$/s) ?? [];
  const customCommand = commands.find((command) => command.name === name);
  return customCommand && `${customCommand.prompt}${input ? `: ${input}` : ""}`;
}

// Commands can reference gists (`@[Gist]`) and files in the open gist (`#[File]`).
const REFERENCE_PATTERN = /([@#])\[([^\]]+)]/g;

export const findReferences = (command: string) =>
  [...command.matchAll(REFERENCE_PATTERN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    symbol: match[1],
    name: match[2],
  }));

/** Reads the contents of a command's references (as context for the agent), and quotes them in its prompt. */
export async function resolveReferences(command: string, gistId: string | undefined) {
  const gists = await readGists();
  const references: AdditionalReference[] = [];

  for (const { symbol, name } of findReferences(command)) {
    if (symbol === "@") {
      const gist = gists.find((gist) => getGistDisplayName(gist) === name);
      if (gist) references.push({ title: name, content: await readFile(gist.id) });
    } else if (gistId) {
      references.push({
        title: name,
        content: await readFile(gistId, toMarkdownFilename(name)),
      });
    }
  }

  return { prompt: command.replace(REFERENCE_PATTERN, '"$2"'), references };
}
