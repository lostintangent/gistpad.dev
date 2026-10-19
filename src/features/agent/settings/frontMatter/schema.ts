import type { Preferences } from "@/features/account/queries";
import { splitFrontMatter, withFrontMatter } from "@/shared/frontMatter";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

// The agent is configured via (YAML) frontmatter: in a file (for that file), or in the user's
// global settings (which are saved in their preferences). Since users write it by hand,
// any invalid settings are ignored (and any unknown properties are preserved).

const text = z.string().optional().catch(undefined);
const section = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.looseObject(shape).optional().catch(undefined);

/** A custom slash command's prompt (or an object with a prompt and description). */
const commandSchema = z.union([z.string(), z.object({ prompt: text, description: text })]);

/** The settings for a kind of command: edits, or reviews (whose settings questions share). */
const commandSettingsSchema = section({
  // An invalid command is empty (and ignored), rather than invalidating the others
  commands: z.record(z.string(), commandSchema.catch("")).optional().catch(undefined),
  instructions: text,
  /** Whether a file's settings replace the global ones (rather than adding to them). */
  overridesGlobalSettings: z.boolean().optional().catch(undefined),
});

/** The agent's settings, as they're written in frontmatter. */
const frontMatterSettingsSchema = z.object({
  general: section({ instructions: text }),
  edit: commandSettingsSchema,
  review: commandSettingsSchema,
  /** The voice assistant's settings. */
  talk: section({ voice: text, persona: text, instructions: text }),
});

/** Frontmatter, which configures the agent (alongside any other properties, which are preserved). */
const frontMatterSchema = frontMatterSettingsSchema.loose();

export type FrontMatterSettings = z.infer<typeof frontMatterSettingsSchema>;
export type FrontMatter = z.infer<typeof frontMatterSchema>;
export type CommandSettings = NonNullable<FrontMatterSettings["edit"]>;
export type TalkSettings = NonNullable<FrontMatterSettings["talk"]>;

/** Parses markdown content's frontmatter (which is null if it doesn't have any, or it's invalid). */
export function parseFrontMatter(content: string): FrontMatter | null {
  const { frontMatterYaml } = splitFrontMatter(content);
  if (frontMatterYaml === undefined) return null;

  try {
    return frontMatterSchema.safeParse(parseYaml(frontMatterYaml)).data ?? null;
  } catch (error) {
    console.warn("Error parsing frontmatter:", error);
    return null;
  }
}

/** Replaces the frontmatter of markdown content (or removes it, if it's empty). */
export function updateFrontMatter(content: string, frontMatter: FrontMatter) {
  const yaml =
    Object.keys(frontMatter).length > 0 ? stringifyYaml(frontMatter).trimEnd() : undefined;
  return withFrontMatter(splitFrontMatter(content).content, yaml);
}

/** The global settings that users start with (until they customize them). */
const DEFAULT_GLOBAL_SETTINGS: FrontMatter = {
  edit: {
    commands: {
      fix: "Fix any issues in this document, such as typos, grammar errors, or formatting problems.",
      improve:
        "Improve the quality of this document, such as enhancing clarity, conciseness, or completeness.",
      expand: "Expand on the content of this document, adding more details or examples.",
    },
  },
  review: {
    commands: {
      clarity: "Provide suggestions for improving the clarity of this document.",
      conciseness: "Provide suggestions for making this document more concise.",
      completeness: "Provide suggestions for making this document more complete.",
    },
  },
};

/** Parses the user's global settings (e.g. custom commands), which are saved in their preferences. */
export function parseGlobalSettings({ globalFrontMatter }: Preferences): FrontMatter {
  if (!globalFrontMatter) return DEFAULT_GLOBAL_SETTINGS;

  try {
    return frontMatterSchema.parse(JSON.parse(globalFrontMatter));
  } catch {
    return {};
  }
}

/** Updates the user's global settings, and returns the preferences that save them. */
export function updateGlobalSettings(
  preferences: Preferences,
  update: (settings: FrontMatter) => FrontMatter,
): Partial<Preferences> {
  return { globalFrontMatter: JSON.stringify(update(parseGlobalSettings(preferences))) };
}
