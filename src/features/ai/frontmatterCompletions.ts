import { VOICES } from "./commands";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

// The AI settings that a document can configure (see `getModeSettings`)
const frontmatterProperties = [
  { label: "general", info: "Configure AI settings for all commands" },
  { label: "edit", info: "Configure AI edit commands and settings" },
  { label: "discuss", info: "Configure AI discuss commands and settings" },
  { label: "talk", info: "Configure AI voice and conversation settings" },
];

// The properties that can be nested under each of the top-level properties
const nestedProperties: Record<string, Completion[]> = {
  general: [{ label: "instructions", info: "Set default instructions for all AI commands" }],
  edit: [
    { label: "instructions", info: "Set default instructions for edit commands" },
    { label: "commands", info: "Add custom slash commands to edit this file" },
  ],
  discuss: [
    { label: "instructions", info: "Set default instructions for discuss commands" },
    { label: "commands", info: "Add custom slash commands for this file" },
  ],
  talk: [
    { label: "persona", info: "Define the AI's personality and behavior" },
    { label: "instructions", info: "Set the main goal(s) or task for the AI" },
    { label: "voice", info: "Configure the AI voice to use for this document" },
  ],
};

const voiceValues = VOICES.map(({ name, description }) => ({ label: name, info: description }));

const completeFrom = (from: number, options: Completion[]): CompletionResult => ({
  from,
  options: options.map((option) => ({ ...option, type: "frontmatter" })),
  validFor: /^\w*$/,
});

export async function frontmatterCompletions(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const { doc } = context.state;
  const line = doc.lineAt(context.pos);
  if (line.number > 50 || !doc.sliceString(0, 100).startsWith("---")) return null;

  // (The frontmatter parser is large, and so it's loaded on demand)
  const { parseFrontMatter } = await import("./frontMatter");

  // Check if we're after a "voice:" property within talk section
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  if (/^\s*voice\s*:\s+\w*$/.test(beforeCursor)) {
    return completeFrom(context.matchBefore(/\w*$/)!.from, voiceValues);
  }

  // Check if we're in a nested property context (i.e. indented under a top-level property)
  const parentLine = doc.lineAt(line.number - 1).text.trim();
  const section = /^\s{2}(\w*)$/.test(beforeCursor)
    ? Object.keys(nestedProperties).find((property) => parentLine.startsWith(`${property}:`))
    : undefined;

  const prefix = context.matchBefore(section ? /^\s{2}(\w*)$/ : /^\s*(\w*)$/);
  if (!prefix) return null;

  // Filter out properties that are already defined
  const { frontMatter } = parseFrontMatter(doc.toString());
  const definedProperties = section ? frontMatter?.[section] || {} : frontMatter;
  const properties = section ? nestedProperties[section] : frontmatterProperties;

  return completeFrom(
    prefix.from,
    properties.filter(({ label }) => !definedProperties || !(label in definedProperties)),
  );
}
