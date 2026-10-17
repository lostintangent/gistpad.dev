import type { FrontMatter } from "@/shared/frontMatter";
import type { CommandMode } from "./useAiCommands";

/** The modes that commands can be run in (where "auto" detects the mode from the command). */
export type ActionBarMode = CommandMode | "talk";

/** A custom slash command, which is defined in a document's frontmatter (or the user's global settings). */
export interface CustomCommand {
  name: string;
  prompt: string;
  description: string;
  isGlobal: boolean;
}

function readCommands(section: FrontMatter | undefined, isGlobal: boolean): CustomCommand[] {
  const commands: Record<string, string | { prompt?: string; description?: string }> =
    section?.commands ?? {};

  return Object.entries(commands).flatMap(([name, value]) => {
    // Commands are usually a prompt, but can also be an object with a prompt and description
    const prompt = typeof value === "string" ? value : value?.prompt;
    const description = typeof value === "string" ? value : (value?.description ?? "");
    return typeof prompt === "string" && prompt ? [{ name, prompt, description, isGlobal }] : [];
  });
}

/** The custom commands that are available in a mode (where the document's commands take precedence). */
export function getCustomCommands(
  mode: ActionBarMode,
  frontMatter: FrontMatter | null,
  globalFrontMatter: FrontMatter,
) {
  if (mode === "research" || mode === "talk") return [];

  const section = mode === "edit" ? "edit" : "discuss";
  const documentCommands = readCommands(frontMatter?.[section], false);
  const globalCommands =
    frontMatter?.[section]?.overridesGlobalSettings === true
      ? []
      : readCommands(globalFrontMatter[section], true);

  const names = new Set(documentCommands.map(({ name }) => name));
  return [...documentCommands, ...globalCommands.filter(({ name }) => !names.has(name))].sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}

/** Expands a slash command (e.g. `/summarize briefly`) into its prompt, plus any input that follows it. */
export function expandCustomCommand(command: string, commands: CustomCommand[]) {
  const [, name, input] = command.match(/^\/(\S+)\s*(.*)$/s) ?? [];
  const customCommand = commands.find((command) => command.name === name);
  return customCommand && `${customCommand.prompt}${input ? `: ${input}` : ""}`;
}
