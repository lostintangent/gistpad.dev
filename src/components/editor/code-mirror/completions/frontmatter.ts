import { parseFrontMatter } from "@/lib/utils";
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

const frontmatterProperties = [
  { label: "edit", info: "Configure AI edit commands and settings" },
  { label: "discuss", info: "Configure AI discuss commands and settings" },
  { label: "talk", info: "Configure AI voice and conversation settings" },
];

const editProperties = [
  { label: "instructions", info: "Set default instructions for edit commands" },
  { label: "commands", info: "Add custom slash commands to edit this file" },
];

const discussProperties = [
  { label: "instructions", info: "Set default instructions for discuss commands" },
  { label: "commands", info: "Add custom slash commands for this file" },
];

const talkProperties = [
  { label: "persona", info: "Define the AI's personality and behavior" },
  { label: "instructions", info: "Set the main goal(s) or task for the AI" },
  { label: "voice", info: "Configure the AI voice to use for this document" },
];

const voiceValues = [
  { label: "alloy", info: "Easygoing and versatile" },
  { label: "ash", info: "Composed and direct" },
  { label: "ballard", info: "Confident and optimistic" },
  { label: "coral", info: "Open and upbeat" },
  { label: "echo", info: "Cheerful and candid" },
  { label: "sage", info: "Savvy and relaxed" },
  { label: "shimmer", info: "Calm and affirming" },
  { label: "verse", info: "Bright and inquisitive" },
];

export function frontmatterCompletions(
  context: CompletionContext
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const docStart = line.number <= 50;
  const hasFrontmatterStart = context.state.doc
    .slice(0, 100)
    .toString()
    .startsWith("---");

  if (!docStart || !hasFrontmatterStart) return null;

  // Check if we're after a "voice:" property within talk section
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  const isVoiceValue = /^\s*voice\s*:\s+\w*$/.test(beforeCursor);

  if (isVoiceValue) {
    const prefix = context.matchBefore(/\w*$/);
    if (!prefix) return null;

    return {
      from: prefix.from,
      options: voiceValues.map((opt) => ({
        ...opt,
        type: "frontmatter",
      })),
      validFor: /^\w*$/,
    };
  }

  // Check if we're in a nested property context
  const isEditProperty = /^\s*edit\s*:\s*$/.test(beforeCursor) ||
    /^\s{2}(\w*)$/.test(beforeCursor) &&
    context.state.doc
      .lineAt(line.number - 1)
      .text.trim()
      .startsWith("edit:");

  const isDiscussProperty = /^\s*discuss\s*:\s*$/.test(beforeCursor) ||
    /^\s{2}(\w*)$/.test(beforeCursor) &&
    context.state.doc
      .lineAt(line.number - 1)
      .text.trim()
      .startsWith("discuss:");

  const isTalkProperty = /^\s*talk\s*:\s*$/.test(beforeCursor) ||
    /^\s{2}(\w*)$/.test(beforeCursor) &&
    context.state.doc
      .lineAt(line.number - 1)
      .text.trim()
      .startsWith("talk:");

  // Handle nested property completions
  if (isEditProperty || isDiscussProperty || isTalkProperty) {
    const prefix = context.matchBefore(/^\s{2}(\w*)$/);
    if (!prefix) return null;

    let propertyOptions = frontmatterProperties;
    if (isEditProperty) {
      propertyOptions = editProperties;
    } else if (isDiscussProperty) {
      propertyOptions = discussProperties;
    } else if (isTalkProperty) {
      propertyOptions = talkProperties;
    }

    // Get the current document content up to this point to filter out properties already defined
    const docContent = context.state.doc.toString();
    const { frontMatter } = parseFrontMatter(docContent);

    let section = {};
    if (isEditProperty && frontMatter?.edit) {
      section = frontMatter.edit;
    } else if (isDiscussProperty && frontMatter?.discuss) {
      section = frontMatter.discuss;
    } else if (isTalkProperty && frontMatter?.talk) {
      section = frontMatter.talk;
    }

    // Filter out properties that are already defined in the section
    const availableProperties = propertyOptions.filter(
      (prop) => !section || !(prop.label in section)
    );

    return {
      from: prefix.from,
      options: availableProperties.map((prop) => ({
        ...prop,
        type: "frontmatter",
      })),
      validFor: /^\w*$/,
    };
  }

  // Top-level property completion
  const prefix = context.matchBefore(/^\s*(\w*)$/);
  if (!prefix) return null;

  // Get the current document content up to this point
  const docContent = context.state.doc.toString();
  const { frontMatter } = parseFrontMatter(docContent);

  // Filter out properties that are already defined in the frontmatter
  const availableProperties = frontmatterProperties.filter(
    (prop) => !frontMatter || !(prop.label in frontMatter)
  );

  return {
    from: prefix.from,
    options: availableProperties.map((prop) => ({
      ...prop,
      type: "frontmatter",
    })),
    validFor: /^\w*$/,
  };
}
