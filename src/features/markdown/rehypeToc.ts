import type { Element, Root } from "hast";
import { headingRank } from "hast-util-heading-rank";
import { toString } from "hast-util-to-string";
import { h } from "hastscript";
import { SKIP, visit } from "unist-util-visit";

// A rehype plugin that replaces ```toc code blocks with a table of contents for the document.
// It runs after `rehype-slug`, so that each heading already has the ID that its link targets.

const isTocBlock = (node: Element) =>
  node.tagName === "pre" &&
  node.children.some(
    (child) =>
      child.type === "element" &&
      child.tagName === "code" &&
      (child.properties.className as string[] | undefined)?.includes("language-toc"),
  );

export default function rehypeToc() {
  return (tree: Root) => {
    const headings: { id: string; text: string; level: number }[] = [];
    visit(tree, "element", (node) => {
      const level = headingRank(node);
      const { id } = node.properties;

      // Footnotes are rendered with a heading, which isn't part of the document's outline.
      if (level && typeof id === "string" && id !== "footnote-label") {
        headings.push({ id, text: toString(node).trim(), level });
      }
    });

    const toc = h("div.markdown-toc", [
      h(
        "ul.list-none.pl-0",
        headings.map(({ id, text, level }) =>
          h("li.pl-4", { style: `margin-left: ${level - 1}rem` }, [
            h("a", { href: `#${id}` }, text),
          ]),
        ),
      ),
    ]);

    visit(tree, "element", (node, index, parent) => {
      if (!parent || index === undefined || !isTocBlock(node)) return;
      parent.children[index] = toc;
      return SKIP;
    });
  };
}
