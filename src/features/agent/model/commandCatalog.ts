import type { Command } from "@/features/commands/command";
import { executeCommand, findCommand, getRegisteredCommands } from "@/features/commands/registry";
import { z } from "zod";
import { defineTool } from "./tools";

// The app's commands are the agent's catalog of actions: those that declare what they do for the
// agent (see `Command.agent`) are described to it, along with their state, and it runs them with one
// tool (by id, as the palette would), so features expose actions by registering commands, not by
// writing tools.

/** The commands that the agent can run right now (i.e. the enabled ones that are meant for it). */
export const getAgentCommands = (commands: readonly Command[] = getRegisteredCommands()) =>
  commands.filter((command) => command.agent && !command.disabled);

/** Describes the agent's commands (for its context), or nothing when there are none. */
export function describeCommands(commands: readonly Command[] = getRegisteredCommands()) {
  const available = getAgentCommands(commands);
  if (available.length === 0) return null;

  const lines = available.map(({ id, agent, acceptsInput, checked }) => {
    const state = checked === undefined ? "" : ` (currently ${checked ? "on" : "off"})`;
    return `- ${id}: ${agent}${acceptsInput ? " (takes input)" : ""}${state}`;
  });
  return `<commands>\n${lines.join("\n")}\n</commands>`;
}

export const runCommandTool = defineTool({
  name: "run_command",
  description:
    "Runs one of GistPad's commands for the user (e.g. to change the view, save, or open a file). The available commands (and their ids) are listed in the <commands> tag, which is kept up to date, so use the most recent list. Only run a command when the user asks for what it does.",
  parameters: z.object({
    id: z.string().describe("The command's id, exactly as listed."),
    input: z
      .string()
      .nullable()
      .describe(
        "The text that a command which takes input needs (e.g. a new gist's title), or null.",
      ),
  }),
  execute: async ({ id, input }) => {
    const command = findCommand(id);
    if (!command?.agent) {
      const ids = getAgentCommands().map((command) => command.id);
      throw new Error(`There's no "${id}" command. The available commands are: ${ids.join(", ")}.`);
    }

    if (!(await executeCommand(command, input ?? undefined))) {
      throw new Error(`"${command.title}" isn't available right now.`);
    }
    return `Ran "${command.title}".`;
  },
});
