import { findQuoteMatches, type CommentHighlights } from "@/features/comments/threads";
import type { Element, Parent, Root, Text } from "hast";
import { SKIP, visit } from "unist-util-visit";

// A rehype plugin that wraps the text that comments quote in `span[data-comment-id]` elements,
// which the preview renders as highlights. Quotes are matched within individual text nodes
// (excluding code and diagrams), and only when they appear exactly once in the document.

const SKIPPED_ELEMENTS = new Set(["pre", "code", "svg"]);

export default function rehypeCommentHighlights({ threads }: CommentHighlights) {
  return (tree: Root) => {
    const textNodes: { node: Text; parent: Parent }[] = [];
    visit(tree, (node, _, parent) => {
      if (node.type === "element" && SKIPPED_ELEMENTS.has(node.tagName)) return SKIP;
      if (node.type === "text" && parent) textNodes.push({ node, parent });
    });

    const matches = findQuoteMatches(
      threads,
      textNodes.map(({ node }) => node.value),
    );

    for (const [segment, segmentMatches] of Map.groupBy(matches, ({ segment }) => segment)) {
      const { node, parent } = textNodes[segment];
      const { value } = node;
      const pieces: (Text | Element)[] = [];
      let index = 0;

      for (const { thread, start, end } of segmentMatches.sort((a, b) => a.start - b.start)) {
        // Overlapping quotes can't both be highlighted
        if (start < index) continue;

        if (start > index) pieces.push({ type: "text", value: value.slice(index, start) });
        pieces.push({
          type: "element",
          tagName: "span",
          properties: { dataCommentId: thread.comment.id },
          children: [{ type: "text", value: value.slice(start, end) }],
        });
        index = end;
      }

      if (index < value.length) pieces.push({ type: "text", value: value.slice(index) });
      parent.children.splice(parent.children.indexOf(node), 1, ...pieces);
    }
  };
}
