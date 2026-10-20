import { frontMatterEnd } from "@/features/editor/extensions/markdown/frontmatter";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { VOICES } from "../../talk/voices";
import type { FrontMatterSettings } from "./schema";

// The agent settings that a file can configure, and the properties that each of them contains
const settings: Record<keyof FrontMatterSettings, { info: string; properties: Completion[] }> = {
  general: {
    info: "Configure agent settings for all commands",
    properties: [
      { label: "instructions", info: "Set default instructions for all agent commands" },
    ],
  },
  edit: {
    info: "Configure agent edit commands and settings",
    properties: [
      { label: "instructions", info: "Set default instructions for edit commands" },
      { label: "commands", info: "Add custom slash commands to edit this file" },
    ],
  },
  review: {
    info: "Configure agent review (and question) commands and settings",
    properties: [
      {
        label: "instructions",
        info: "Set default instructions for review (and question) commands",
      },
      { label: "commands", info: "Add custom slash commands for this file" },
    ],
  },
  talk: {
    info: "Configure voice assistant settings",
    properties: [
      { label: "persona", info: "Define the voice assistant's personality and behavior" },
      { label: "instructions", info: "Set the main goal(s) or task for the voice assistant" },
      { label: "voice", info: "Configure the voice to use for this file" },
    ],
  },
};

const sections = Object.keys(settings) as (keyof FrontMatterSettings)[];

const voiceValues = VOICES.map(({ name, description }) => ({ label: name, info: description }));

const completeFrom = (from: number, options: Completion[]): CompletionResult => ({
  from,
  options: options.map((option) => ({ ...option, type: "frontmatter" })),
  validFor: /^\w*$/,
});

export async function frontMatterCompletions(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const { doc } = context.state;
  const end = frontMatterEnd(doc);
  if (end === null || context.pos > end) return null;

  const line = doc.lineAt(context.pos);

  // Check if we're after a "voice:" property within talk section
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  if (/^\s*voice\s*:\s+\w*$/.test(beforeCursor)) {
    return completeFrom(context.matchBefore(/\w*$/)!.from, voiceValues);
  }

  // Check if we're in a nested property context (i.e. indented under a top-level property)
  const parentLine = doc.lineAt(line.number - 1).text.trim();
  const section = /^\s{2}(\w*)$/.test(beforeCursor)
    ? sections.find((section) => parentLine.startsWith(`${section}:`))
    : undefined;

  const prefix = context.matchBefore(section ? /^\s{2}(\w*)$/ : /^\s*(\w*)$/);
  if (!prefix) return null;

  // Filter out properties that are already defined (the frontmatter parser is large, and so
  // it's loaded on demand)
  const { parseFrontMatter } = await import("./schema");
  const frontMatter = parseFrontMatter(doc.toString());
  const definedProperties = (section ? frontMatter?.[section] : frontMatter) ?? {};
  const properties = section
    ? settings[section].properties
    : sections.map((section) => ({ label: section, info: settings[section].info }));

  return completeFrom(
    prefix.from,
    properties.filter(({ label }) => !(label in definedProperties)),
  );
}
