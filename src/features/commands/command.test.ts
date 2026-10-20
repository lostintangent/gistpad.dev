import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { toast } from "sonner";
import type { Command } from "./command";
import { executeCommand } from "./registry";

afterEach(() => mock.restore());

describe("command execution", () => {
  test("passes caller input through and waits for completion", async () => {
    const calls: string[] = [];
    const command: Command = {
      id: "example",
      title: "Example",
      acceptsInput: true,
      run: async (input) => {
        await Promise.resolve();
        calls.push(input ?? "default");
      },
    };

    expect(await executeCommand(command, "some text")).toBe(true);
    expect(await executeCommand(command)).toBe(true);
    expect(calls).toEqual(["some text", "default"]);
  });

  test("does not invoke a disabled command", async () => {
    const run = mock(() => {});
    expect(await executeCommand({ id: "disabled", title: "Disabled", disabled: true, run })).toBe(
      false,
    );
    expect(run).not.toHaveBeenCalled();
  });

  test("reports rejected and thrown operations without an unhandled event rejection", async () => {
    const error = new Error("Cannot complete the operation");
    const log = spyOn(console, "error").mockImplementation(() => {});
    const notify = spyOn(toast, "error").mockReturnValue(0);
    for (const run of [
      () => {
        throw error;
      },
      () => Promise.reject(error),
    ]) {
      expect(await executeCommand({ id: "example", title: "Example", run })).toBe(false);
    }
    expect(log).toHaveBeenCalledWith("Failed to run command example:", error);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith('Could not run "Example".');
  });
});
