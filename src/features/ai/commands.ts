import type { Preferences } from "@/features/account/queries";
import { readFile, readGists } from "@/features/gists/queries";
import type { FrontMatter } from "./frontMatter";
import { getGistDisplayName, toMarkdownFilename } from "@/shared/github";
import type { AdditionalReference } from "./agents/openai";
/** The kinds of AI commands (which each have their own agent and model). */
export type AiMode = "ask" | "edit" | "review" | "research";

/** The action bar's modes, where "auto" detects a command's mode, and "talk" sends it to the voice assistant. */
export type ActionBarMode = AiMode | "auto" | "talk";

/** A custom slash command, which is defined in a file's frontmatter (or the user's global settings). */
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

/** The global AI settings that users start with (until they customize them). */
const DEFAULT_GLOBAL_FRONT_MATTER: FrontMatter = {
  edit: {
    commands: {
      fix: "Fix any issues in this document, such as typos, grammar errors, or formatting problems.",
      improve:
        "Improve the quality of this document, such as enhancing clarity, conciseness, or completeness.",
      expand: "Expand on the content of this document, adding more details or examples.",
    },
  },
  discuss: {
    commands: {
      clarity: "Provide suggestions for improving the clarity of this document.",
      conciseness: "Provide suggestions for making this document more concise.",
      completeness: "Provide suggestions for making this document more complete.",
    },
  },
};

/** Parses the user's global AI settings (e.g. custom commands), which are saved in their preferences. */
export function parseGlobalFrontMatter({ globalFrontMatter }: Preferences): FrontMatter {
  if (!globalFrontMatter) return DEFAULT_GLOBAL_FRONT_MATTER;

  try {
    return JSON.parse(globalFrontMatter) ?? {};
  } catch {
    return {};
  }
}

/**
 * A mode's custom commands and instructions, from the file's frontmatter and the user's global
 * settings (where the file's commands take precedence, and its settings can override the global
 * ones). Questions and reviews share the "discuss" settings, while talk has its own (e.g. a voice).
 */
export function getModeSettings(
  mode: ActionBarMode,
  frontMatter: FrontMatter | null,
  globalFrontMatter: FrontMatter,
) {
  if (mode === "research" || mode === "talk") return { commands: [], instructions: undefined };

  const section = mode === "edit" ? "edit" : "discuss";
  const local = frontMatter?.[section];
  const global = local?.overridesGlobalSettings === true ? undefined : globalFrontMatter[section];

  const documentCommands = readCommands(local, false);
  const names = new Set(documentCommands.map(({ name }) => name));
  const commands = [
    ...documentCommands,
    ...readCommands(global, true).filter(({ name }) => !names.has(name)),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const instructions = [
    globalFrontMatter.general?.instructions,
    frontMatter?.general?.instructions,
    global?.instructions,
    local?.instructions,
  ].filter(Boolean);

  return {
    commands,
    instructions: instructions.length > 0 ? instructions.join("\n\n---\n\n") : undefined,
  };
}

/** The voices that the voice assistant can talk with (configured by the "talk" settings). */
export const VOICES = [
  { name: "alloy", description: "Easygoing and versatile" },
  { name: "ash", description: "Composed and direct" },
  { name: "ballad", description: "Confident and optimistic" },
  { name: "coral", description: "Open and upbeat" },
  { name: "echo", description: "Cheerful and candid" },
  { name: "sage", description: "Savvy and relaxed" },
  { name: "shimmer", description: "Calm and affirming" },
  { name: "verse", description: "Bright and inquisitive" },
];

export const DEFAULT_VOICE = "alloy";

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

/** Reads the contents of a command's references (as context for the AI), and quotes them in its prompt. */
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
