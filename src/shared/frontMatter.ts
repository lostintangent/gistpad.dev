import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { splitFrontMatter, withFrontMatter } from "./utils";

/** A document's (YAML) frontmatter, which can contain arbitrary settings (e.g. for AI features). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FrontMatter = Record<string, any>;

/** Parses markdown content's frontmatter (which is null if it doesn't have any, or it's invalid). */
export function parseFrontMatter(content: string): {
  frontMatter: FrontMatter | null;
  frontMatterYaml?: string;
  content: string;
} {
  const { frontMatterYaml, content: remainingContent } = splitFrontMatter(content);
  if (frontMatterYaml === undefined) return { frontMatter: null, content };

  try {
    return { frontMatter: parseYaml(frontMatterYaml), frontMatterYaml, content: remainingContent };
  } catch (error) {
    console.warn("Error parsing frontmatter:", error);
    return { frontMatter: null, content };
  }
}

/** Replaces the frontmatter of markdown content (or removes it, if it's empty). */
export function updateFrontMatter(content: string, frontMatter: FrontMatter) {
  const yaml =
    Object.keys(frontMatter).length > 0 ? stringifyYaml(frontMatter).trimEnd() : undefined;
  return withFrontMatter(splitFrontMatter(content).content, yaml);
}
