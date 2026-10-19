import { usePreferences } from "@/features/account/queries";
import { useFileContent, type ActiveFile } from "@/features/files/file";
import { DEFAULT_VOICE } from "../voice/voices";
import {
  parseFrontMatter,
  parseGlobalSettings,
  type CommandSettings,
  type TalkSettings,
} from "./frontMatter/schema";

/** A custom slash command, which is defined in a file's frontmatter (or the user's global settings). */
export interface CustomCommand {
  name: string;
  prompt: string;
  description: string;
  isGlobal: boolean;
}

/**
 * The agent's settings for a file, which combine the file's frontmatter with the user's global
 * settings (where the file's settings take precedence). They have the same sections as the
 * frontmatter, where questions share the review settings.
 */
export function useAgentSettings(file: ActiveFile) {
  const content = useFileContent(file);
  const preferences = usePreferences();
  const local = parseFrontMatter(content) ?? {};
  const global = parseGlobalSettings(preferences);

  return {
    general: {
      instructions: joinInstructions(global.general?.instructions, local.general?.instructions),
    },
    edit: resolveCommandSettings(local.edit, global.edit),
    review: resolveCommandSettings(local.review, global.review),
    talk: resolveTalkSettings(local.talk, global.talk),
  };
}

/**
 * A kind of command's settings, which add to the global ones: its instructions follow the global
 * instructions, and its commands replace any global commands with the same name.
 */
function resolveCommandSettings(local?: CommandSettings, global?: CommandSettings) {
  // A file can replace the global settings (rather than adding to them)
  if (local?.overridesGlobalSettings) global = undefined;

  const localCommands = readCommands(local, false);
  const localNames = new Set(localCommands.map(({ name }) => name));
  const globalCommands = readCommands(global, true).filter(({ name }) => !localNames.has(name));

  return {
    instructions: joinInstructions(global?.instructions, local?.instructions),
    commands: [...localCommands, ...globalCommands].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** The voice assistant's settings, where each of the file's settings replaces the global one. */
function resolveTalkSettings(local?: TalkSettings, global?: TalkSettings) {
  const talk = { ...global, ...local };
  return { ...talk, voice: talk.voice || DEFAULT_VOICE };
}

/** A section's custom commands, where a command is a prompt (or a prompt and a description). */
function readCommands(settings: CommandSettings | undefined, isGlobal: boolean): CustomCommand[] {
  return Object.entries(settings?.commands ?? {}).flatMap(([name, command]) => {
    const { prompt, description = "" } =
      typeof command === "string" ? { prompt: command, description: command } : command;

    // Invalid commands are empty, and ignored
    return prompt ? [{ name, prompt, description, isGlobal }] : [];
  });
}

/** Joins the global and file instructions, so that the file's instructions come last. */
function joinInstructions(global?: string, local?: string) {
  return [global, local].filter(Boolean).join("\n\n---\n\n") || undefined;
}
