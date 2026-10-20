import { describe, expect, test } from "bun:test";
import {
  availableAgentCommands,
  findReferences,
  prepareAgentInput,
  type AgentCommand,
  type AgentCommandSettings,
} from "./input";
import { AGENT_MODES, availableAgentModes, resolveComposerMode } from "./modes";

const edit: AgentCommand = {
  name: "polish",
  prompt: "Polish the prose",
  description: "Polish",
  isGlobal: true,
  defaultMode: "edit",
};
const ask: AgentCommand = {
  name: "explain",
  prompt: "Explain the text",
  description: "Explain",
  isGlobal: false,
  defaultMode: "ask",
};
const settings: AgentCommandSettings = { edit: { commands: [edit] }, review: { commands: [ask] } };

describe("agent commands", () => {
  test("auto discovers both sections; explicit modes discover only their own commands", () => {
    expect(availableAgentCommands(settings, "auto")).toEqual([ask, edit]);
    expect(availableAgentCommands(settings, "edit")).toEqual([edit]);
    expect(availableAgentCommands(settings, "ask")).toEqual([ask]);
    expect(availableAgentCommands(settings, "review")).toEqual([ask]);
    expect(availableAgentCommands(settings, "research")).toEqual([]);
    expect(availableAgentCommands(settings, "talk")).toEqual([]);
  });

  test("ask/review keeps precedence for a shared slash name in auto", () => {
    const shared = { ...ask, name: edit.name };
    const overlapping = { ...settings, review: { commands: [shared] } };
    expect(availableAgentCommands(overlapping, "auto")).toEqual([shared]);
    expect(prepareAgentInput("/polish", "auto", overlapping, true)).toEqual({
      prompt: shared.prompt,
      mode: "ask",
    });
    expect(prepareAgentInput("/polish", "edit", overlapping, true)).toEqual({
      prompt: edit.prompt,
      mode: "edit",
    });
  });

  test("expands slash commands and their additional input before auto classification", () => {
    expect(
      prepareAgentInput(" /polish  the introduction\nand conclusion ", "auto", settings, true),
    ).toEqual({
      prompt: "Polish the prose: the introduction\nand conclusion",
      mode: "edit",
    });
    expect(prepareAgentInput("/explain", "auto", settings, true)).toEqual({
      prompt: ask.prompt,
      mode: "ask",
    });
  });

  test("preserves an explicit response mode", () => {
    expect(prepareAgentInput("/explain", "review", settings, true)).toEqual({
      prompt: ask.prompt,
      mode: "review",
    });
  });

  test("leaves ordinary, unknown, and unavailable slash text intact", () => {
    for (const prompt of ["A normal request", "/unknown input", "/explain-extra", "/"]) {
      expect(prepareAgentInput(` ${prompt} `, "auto", settings, true)).toEqual({
        prompt,
        mode: "auto",
      });
    }
    expect(prepareAgentInput("/polish", "ask", settings, true)).toEqual({
      prompt: "/polish",
      mode: "ask",
    });
    expect(prepareAgentInput("/explain", "research", settings, true)).toEqual({
      prompt: "/explain",
      mode: "research",
    });
  });

  test("slash preparation follows the composer's no-file availability", () => {
    expect(prepareAgentInput("/polish", "auto", settings, false)).toEqual({
      prompt: "/polish",
      mode: "auto",
    });
  });
});

describe("agent context eligibility", () => {
  test("only ask and research are available without a file", () => {
    expect(availableAgentModes(false)).toEqual(["ask", "research"]);
    expect(availableAgentModes(true)).toEqual(AGENT_MODES);
  });

  test("hides invalid selected modes without discarding the user's selection", () => {
    expect(resolveComposerMode("edit", false, false)).toBe("auto");
    expect(resolveComposerMode("review", false, false)).toBe("auto");
    expect(resolveComposerMode("edit", true, false)).toBe("edit");
    expect(resolveComposerMode("ask", false, false)).toBe("ask");
    expect(resolveComposerMode("auto", false, false)).toBe("auto");
  });

  test("an active voice session wins only in its file context", () => {
    expect(resolveComposerMode("edit", true, true)).toBe("talk");
    expect(resolveComposerMode("edit", false, true)).toBe("auto");
    expect(resolveComposerMode("talk", true, false)).toBe("auto");
  });
});

describe("agent references", () => {
  test("finds gist and file references with precise ranges, repeatedly", () => {
    const text = "Use @[Other gist] and #[Notes] together.";
    const expected = [
      { start: 4, end: 17, symbol: "@", name: "Other gist" },
      { start: 22, end: 30, symbol: "#", name: "Notes" },
    ];
    expect(findReferences(text)).toEqual(expected);
    expect(findReferences(text)).toEqual(expected);
    expect(findReferences("No references here")).toEqual([]);
  });
});
