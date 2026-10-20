import { describe, expect, mock, test } from "bun:test";
import type { Command } from "./command";
import { matchCommands, searchCommands, type CommandPage } from "./palette";

const command = (id: string, title = id, group?: string): Command => ({
  id,
  title,
  group,
  run: () => {},
});

describe("command discovery", () => {
  test("searches trimmed, case-insensitive titles and groups, not implementation details", () => {
    const save = { ...command("save", "Save", "This gist"), detail: "A document" };
    expect(matchCommands([save], "  SAVE ")).toEqual([save]);
    expect(matchCommands([save], "gist")).toEqual([save]);
    expect(matchCommands([save], "document")).toEqual([]);
    expect(matchCommands([save], "missing")).toEqual([]);
  });

  test("ranks title prefixes, title substrings, then group matches within a group", () => {
    const group = command("group", "Other", "Save operations");
    const substring = command("substring", "Auto-save", "Save operations");
    const prefix = command("prefix", "Save file", "Save operations");
    expect(matchCommands([group, substring, prefix], "save")).toEqual([prefix, substring, group]);
  });

  test("keeps unknown groups contiguous so visual and keyboard order agree", () => {
    const first = command("first", "One", "Custom A");
    const second = command("second", "Two", "Custom B");
    const third = command("third", "Three", "Custom A");
    const known = command("known", "Four", "View");
    expect(matchCommands([first, second, third, known], "")).toEqual([known, first, third, second]);
  });

  test("a page can't shadow a command with the same id", () => {
    const item = command("example");
    const page: CommandPage = { id: item.id, title: "Example page", commands: [] };
    expect(searchCommands([item], [page], "")).toEqual([item, page]);
  });

  test("hides large inventories only while browsing, not while searching", () => {
    const recent = command("recent", "Recent gist", "Recent");
    const target = { ...command("other", "Another gist", "Gists"), searchOnly: true };
    expect(searchCommands([recent, target], [], "")).toEqual([recent]);
    expect(searchCommands([recent, target], [], "gist")).toEqual([recent, target]);
  });

  test("a page stands in for its commands while browsing, which are still searchable", () => {
    const child = command("tag.example", "Example tag");
    const page: CommandPage = { id: "tags", title: "Tags", commands: [child] };
    expect(searchCommands([child], [page], "")).toEqual([page]);
    expect(searchCommands([child], [page], "example")).toEqual([child]);
    expect(matchCommands(page.commands, "example")).toEqual([child]);
  });

  test("a command that takes text is offered the query, after what it matches", () => {
    const run = mock((input?: string) => input);
    const create = { ...command("gist.new", "New gist"), acceptsInput: true, run };
    const target = command("target", "Save the planet");

    const matches = searchCommands([create, target], [], " save ");
    expect(matches.map(({ title }) => title)).toEqual(["Save the planet", "New gist: save"]);
    const invocation = matches[1]!;
    if ("commands" in invocation) throw new Error("Expected a command");
    invocation.run();
    expect(run).toHaveBeenCalledWith("save");
    expect(searchCommands([create], [], "  ")).toEqual([create]);
  });
});
