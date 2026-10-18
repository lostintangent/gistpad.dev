import { evaluateMathExpression, extractVariableAssignments } from "@/shared/calculations";

// A remark plugin for GistPad's custom inline syntax, which is converted into annotated elements
// (rendered by the preview's components). Since some syntax depends on what came before it
// (e.g. numbered bookmarks, and calculations that reference previous results), the document's
// text is transformed in order, with state that's scoped to the current render. And since only
// text nodes are transformed, code (and links) are left as-is.
//
// - Wikilinks: `[[file]]` or `[[gistId]]`
// - Bookmarks: `{#}` or `{#id}`
// - Spoilers: `>!hidden text!<`
// - Mentions: `@username` (which link to GitHub profiles)
// - Emoji shortcodes: `:tada:`
// - Calculations: `total: 5 * 3 =`, `rate := 5`, and `_` (the previous result)

interface Node {
  type: string;
  value?: string;
  children?: Node[];
  data?: { hName: string; hProperties: Record<string, unknown> };
}

const text = (value: string): Node => ({ type: "text", value });

// Elements are inserted into the markdown tree, and rendered as HTML elements (via `data.hName`).
const element = (
  tagName: string,
  properties: Record<string, unknown>,
  children: Node[] = [],
): Node => ({ type: "inlineSyntax", data: { hName: tagName, hProperties: properties }, children });

/** Replaces a pattern's matches in some text with elements (keeping the text between them). */
function replaceMatches(value: string, pattern: RegExp, replace: (match: RegExpExecArray) => Node) {
  const nodes: Node[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(pattern)) {
    if (match.index > lastIndex) nodes.push(text(value.slice(lastIndex, match.index)));
    nodes.push(replace(match));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) nodes.push(text(value.slice(lastIndex)));
  return nodes;
}

const SYNTAX =
  /(?<!!)\[\[([^\]]+)\]\]|\{#([a-zA-Z0-9_-]*)\}|>!([^<>]+)!<|(?<![\w/.@])@([a-zA-Z0-9-]+)\b/g;
const EMOJI_SHORTCODE = /(?<=^|[\s([]):([a-zA-Z0-9_+-]+):/g;
const ASSIGNMENT = /([^:]+):=\s*(\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[km]?)/gi;
const EQUATION = /^(?:([^:]+):\s*)?(.*?)([-+*/().\d\s,$a-zA-Z_-]+)=\s*$/;

const RESULT_CLASSES = "inline-block text-black rounded px-0.5 py-0 select-none";
const NAME_CLASSES = "font-bold text-blue-500";

// Nodes whose text isn't transformed (including the elements that this plugin inserts)
const SKIPPED_NODES = new Set(["link", "linkReference", "inlineSyntax"]);

export default function remarkInlineSyntax({
  emojis,
}: {
  /** Emojis by shortcode (once they've loaded). */
  emojis?: Map<string, string>;
}) {
  return (tree: Node) => {
    let bookmarkCount = 0;
    let previousResult: string | null = null;
    const variables = new Map<string, string>();

    function transformSyntax(value: string): Node[] {
      if (emojis) {
        value = value.replace(
          EMOJI_SHORTCODE,
          (shortcode, id: string) => emojis.get(id) ?? shortcode,
        );
      }

      return replaceMatches(value, SYNTAX, ([syntax, wikilink, bookmark, spoiler, mention]) => {
        if (mention !== undefined) {
          return element("a", { href: `https://github.com/${mention}` }, [
            element("strong", {}, [text(syntax)]),
          ]);
        }
        if (wikilink !== undefined) {
          return element("a", { dataWikilink: wikilink }, [text(wikilink)]);
        }
        if (bookmark !== undefined) {
          return element("a", { dataBookmark: bookmark || `bookmark-${++bookmarkCount}` });
        }
        return element("span", { dataSpoiler: true }, [text(spoiler)]);
      });
    }

    function transformCalculations(value: string): Node[] | null {
      // A line of variable assignments (e.g. `rate := 5`)
      const assignments = extractVariableAssignments(value);
      if (assignments.size > 0) {
        for (const [name, result] of assignments) variables.set(name, result);

        return replaceMatches(value, ASSIGNMENT, ([, name, result]) =>
          element("span", {}, [
            element("span", { className: NAME_CLASSES }, [text(`${name.trim()}: `)]),
            text(result.trim()),
          ]),
        );
      }

      // An equation to evaluate (e.g. `total: 5 * 3 =`)
      const match = value.match(EQUATION);
      if (!match) return null;

      const [, name, prefix, expression] = match;
      const result = evaluateMathExpression(expression, previousResult, variables);
      if (result === null) return null;

      // Show the previous result wherever the equation references it (using `_`)
      const expressionNodes = expression
        .trim()
        .split(/(_)/)
        .filter(Boolean)
        .map((part) =>
          part === "_" && previousResult !== null
            ? element("span", { className: `${RESULT_CLASSES} bg-green-500` }, [
                text(previousResult),
              ])
            : text(part),
        );

      if (name) {
        variables.set(name.trim(), result);
        variables.set(name.trim().replace(/\s+/g, "-"), result);
      }

      previousResult = result;

      return [
        element("span", {}, [
          ...(name ? [element("span", { className: NAME_CLASSES }, [text(`${name}: `)])] : []),
          text(prefix),
          ...expressionNodes,
          text(" ="),
          element("span", { className: `${RESULT_CLASSES} ml-1 bg-amber-500` }, [text(result)]),
        ]),
      ];
    }

    function visit(node: Node) {
      if (!node.children || SKIPPED_NODES.has(node.type)) return;

      node.children = node.children.flatMap((child) =>
        child.type !== "text"
          ? [child]
          : // Calculations are written as their own paragraph
            (node.type === "paragraph" && transformCalculations(child.value!)) ||
            transformSyntax(child.value!),
      );

      for (const child of node.children) visit(child);
    }

    visit(tree);
  };
}
