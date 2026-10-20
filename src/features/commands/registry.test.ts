import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Command } from "./command";
import { executeCommand, findCommand, getRegisteredCommands, registerCommands } from "./registry";

const registrations: ReturnType<typeof registerCommands>[] = [];
const register = (commands: readonly Command[]) => {
  const registration = registerCommands(commands);
  registrations.push(registration);
  return registration;
};
const command = (id: string): Command => ({ id, title: id, run: () => {} });

afterEach(() => {
  for (const registration of registrations.splice(0)) registration.dispose();
});

describe("command registry", () => {
  test("supports lookup and invocation without mounting a palette", async () => {
    const run = mock((input?: string) => input);
    const item = { ...command("example"), run };
    register([item]);

    expect(findCommand(item.id)).toBe(item);
    expect(getRegisteredCommands()).toEqual([item]);
    expect(await executeCommand(item.id, "from a caller")).toBe(true);
    expect(run).toHaveBeenCalledWith("from a caller");
  });

  test("an owner's update replaces its commands, keeping its place among the owners", async () => {
    const first = register([command("first"), command("second")]);
    register([command("third")]);

    first.update([command("second"), command("first")]);
    expect(getRegisteredCommands().map(({ id }) => id)).toEqual(["second", "first", "third"]);
    first.update([{ ...command("first"), disabled: true }]);
    expect(getRegisteredCommands().map(({ id }) => id)).toEqual(["first", "third"]);
    expect(await executeCommand("first")).toBe(false);
  });

  test("disposing an owner removes only its commands", () => {
    const first = register([command("first")]);
    register([command("second")]);

    first.dispose();
    first.dispose();
    expect(findCommand("first")).toBeUndefined();
    expect(findCommand("second")).toBeDefined();
  });

  test("reports a missing command instead of silently succeeding", async () => {
    await expect(executeCommand("missing")).rejects.toThrow('Command "missing" is not registered.');
  });

  test("shares one catalog snapshot until a registration changes", () => {
    const original = command("example");
    const registration = register([original]);
    const snapshot = getRegisteredCommands();
    expect(getRegisteredCommands()).toBe(snapshot);

    const replacement = command("replacement");
    registration.update([replacement]);
    expect(getRegisteredCommands()).toEqual([replacement]);
    expect(snapshot).toEqual([original]);
  });

  test("a command passed by reference runs itself, not a registered namesake", async () => {
    const registered = { ...command("example"), run: mock(() => {}) };
    register([registered]);
    const owned = { ...command("example"), run: mock(() => {}) };

    expect(await executeCommand(owned, "owned")).toBe(true);
    expect(owned.run).toHaveBeenCalledWith("owned");
    expect(registered.run).not.toHaveBeenCalled();
    expect(await executeCommand("example", "registered")).toBe(true);
    expect(registered.run).toHaveBeenCalledWith("registered");
  });
});
