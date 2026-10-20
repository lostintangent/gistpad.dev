import type { AgentMode, ComposerMode } from "./modes";

/** A user-configured slash command aimed at the agent. */
export interface AgentCommand {
  name: string;
  prompt: string;
  description: string;
  isGlobal: boolean;
  defaultMode: "ask" | "edit";
}

export interface AgentCommandSettings {
  edit: { commands: readonly AgentCommand[] };
  review: { commands: readonly AgentCommand[] };
}

export function availableAgentCommands(
  settings: AgentCommandSettings,
  mode: ComposerMode,
): readonly AgentCommand[] {
  if (mode === "talk" || mode === "research") return [];
  if (mode === "edit") return settings.edit.commands;
  if (mode !== "auto") return settings.review.commands;
  // Ask/review commands keep precedence when both sections use the same slash name.
  return [
    ...new Map(
      [...settings.edit.commands, ...settings.review.commands].map((command) => [
        command.name,
        command,
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

/** Every typed entry point resolves slash syntax before the agent classifies or executes a request. */
export function prepareAgentInput(
  text: string,
  mode: AgentMode | "auto",
  settings: AgentCommandSettings,
  hasFile: boolean,
) {
  const prompt = text.trim();
  const [, name, input] = prompt.match(/^\/(\S+)\s*(.*)$/s) ?? [];
  const command = hasFile
    ? availableAgentCommands(settings, mode).find((item) => item.name === name)
    : undefined;
  return command
    ? {
        prompt: `${command.prompt}${input ? `: ${input}` : ""}`,
        mode: mode === "auto" ? command.defaultMode : mode,
      }
    : { prompt, mode };
}

export const REFERENCE_PATTERN = /([@#])\[([^\]]+)]/g;

export const findReferences = (text: string) =>
  [...text.matchAll(REFERENCE_PATTERN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    symbol: match[1],
    name: match[2],
  }));
