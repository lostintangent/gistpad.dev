import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Command } from "@/features/commands/command";
import { registerCommands } from "@/features/commands/registry";
import { describeCommands, runCommandTool } from "./commandCatalog";

const registrations: ReturnType<typeof registerCommands>[] = [];
const register = (commands: readonly Command[]) => {
  const registration = registerCommands(commands);
  registrations.push(registration);
  return registration;
};

afterEach(() => {
  for (const registration of registrations.splice(0)) registration.dispose();
});

describe("the agent's command catalog", () => {
  test("describes the enabled commands that are meant for the agent, with their state", () => {
    const commands: Command[] = [
      {
        id: "view.preview",
        title: "Preview mode",
        agent: "Show the rendered document.",
        checked: true,
        run: () => {},
      },
      {
        id: "view.zen",
        title: "Zen mode",
        agent: "Enter or leave zen mode.",
        checked: false,
        run: () => {},
      },
      {
        id: "file.save",
        title: "Save",
        agent: "Save the document.",
        disabled: true,
        run: () => {},
      },
      {
        id: "gist.new",
        title: "New gist",
        agent: "Create a gist.",
        acceptsInput: true,
        run: () => {},
      },
      { id: "account.signOut", title: "Sign out", run: () => {} },
    ];
    expect(describeCommands(commands)).toBe(
      [
        "<commands>",
        "- view.preview: Show the rendered document. (currently on)",
        "- view.zen: Enter or leave zen mode. (currently off)",
        "- gist.new: Create a gist. (takes input)",
        "</commands>",
      ].join("\n"),
    );
    expect(describeCommands([])).toBeNull();
  });

  test("runs a command by id, passing its input", async () => {
    const run = mock((input?: string) => input);
    register([
      { id: "gist.new", title: "New gist", agent: "Create a gist.", acceptsInput: true, run },
    ]);

    expect(await runCommandTool.execute({ id: "gist.new", input: "Ideas" })).toBe(
      'Ran "New gist".',
    );
    expect(run).toHaveBeenCalledWith("Ideas");
  });

  test("tells the agent what's available when a command isn't", async () => {
    const run = mock(() => {});
    register([
      { id: "view.preview", title: "Preview mode", agent: "Show the rendered document.", run },
      { id: "file.save", title: "Save", agent: "Save the document.", disabled: true, run },
      { id: "account.signOut", title: "Sign out", run },
    ]);

    await expect(runCommandTool.execute({ id: "view.split", input: null })).rejects.toThrow(
      'There\'s no "view.split" command. The available commands are: view.preview.',
    );
    await expect(runCommandTool.execute({ id: "account.signOut", input: null })).rejects.toThrow(
      "There's no",
    );
    await expect(runCommandTool.execute({ id: "file.save", input: null })).rejects.toThrow(
      '"Save" isn\'t available right now.',
    );
    expect(run).not.toHaveBeenCalled();
  });
});
