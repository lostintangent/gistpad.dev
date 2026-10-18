// Only AI features parse frontmatter (see `features/ai/frontMatter.ts`), since its YAML parser is
// large, so these helpers just split it from (and rejoin it to) a document's content.
const FRONT_MATTER = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/** Splits markdown content into its (YAML) frontmatter, and the content that follows it. */
export function splitFrontMatter(content: string): { frontMatterYaml?: string; content: string } {
  const [, frontMatterYaml, remainingContent] = content.match(FRONT_MATTER) ?? [];
  return frontMatterYaml === undefined
    ? { content }
    : { frontMatterYaml, content: remainingContent.trim() };
}

/** Prepends (YAML) frontmatter to markdown content. */
export function withFrontMatter(content: string, frontMatterYaml?: string) {
  return frontMatterYaml ? `---\n${frontMatterYaml}\n---\n\n${content}` : content;
}
