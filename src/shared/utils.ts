import chimeUrl from "@/assets/chime.mp3";
// Frontmatter is parsed by `parseFrontMatter` (in `./frontMatter.ts`), which is separate from these
// helpers, since its YAML parser is large, and only AI features need the parsed settings.
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

export function playAiChime() {
  return new Audio(chimeUrl).play();
}

export function evaluateMathExpression(
  expr: string,
  previousResult: string | null = null,
  variables: Map<string, string> = new Map(),
) {
  if (previousResult !== null) expr = expr.replace(/_/g, previousResult);

  for (const [varName, value] of variables) {
    try {
      expr = expr.replace(new RegExp(`\\$?${varName}`, "gi"), value);
    } catch {
      // ignore invalid regex
    }
  }

  // Replace numbers that may include commas, a leading $, and/or trailing k or M
  // (and format the result as currency, and/or compactly, to match them)
  const options: Intl.NumberFormatOptions = {};
  const normalized = expr.replace(
    /\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)([km])?/gi,
    (match, num, suffix) => {
      if (match.startsWith("$")) Object.assign(options, { style: "currency", currency: "USD" });
      if (suffix) options.notation = "compact";

      const multiplier =
        suffix?.toLowerCase() === "k" ? 1000 : suffix?.toLowerCase() === "m" ? 1_000_000 : 1;
      return (parseFloat(num.replace(/,/g, "")) * multiplier).toString();
    },
  );

  // Only allow numbers, operators and parentheses after normalization
  if (!/^[-+*/().\d\s]+$/.test(normalized)) return null;

  try {
    const result = Function(`"use strict"; return (${normalized})`)();
    if (typeof result === "number" && isFinite(result)) {
      return new Intl.NumberFormat(undefined, options).format(result);
    }
  } catch {
    // ignore
  }
  return null;
}

export function extractVariableAssignments(text: string) {
  const assignments = new Map<string, string>();
  const lineOnlyAssignment =
    /^(?:\s*[-*]\s+)?(?:[^:]+:=\s*\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[km]?\s*)+$/i;
  if (!lineOnlyAssignment.test(text.trim())) return assignments;

  const cleaned = text.replace(/^\s*[-*]\s+/, "");
  const regex = /([^:]+):=\s*(\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[km]?)/gi;
  for (const [, rawName, rawValue] of cleaned.matchAll(regex)) {
    const name = rawName.trim();
    const value = evaluateMathExpression(rawValue);
    if (value !== null) {
      assignments.set(name, value);
      assignments.set(name.replace(/\s+/g, "-"), value);
    }
  }

  return assignments;
}
