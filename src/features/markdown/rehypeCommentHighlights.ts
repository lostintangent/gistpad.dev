import { findQuoteMatches, type QuotedCommentThread } from "@/features/comments/threads";

// A rehype plugin that wraps the text that comments quote in `span[data-comment-id]` elements,
// which the preview renders as highlights. Quotes are matched within individual text nodes
// (excluding code and diagrams), and only when they appear exactly once in the document.

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const SKIPPED_ELEMENTS = new Set(["pre", "code", "svg"]);

export default function rehypeCommentHighlights({ threads }: { threads: QuotedCommentThread[] }) {
  return (tree: HastNode) => {
    const textNodes: { node: HastNode; parent: HastNode }[] = [];
    (function collect(parent: HastNode) {
      for (const node of parent.children ?? []) {
        if (node.type === "text") textNodes.push({ node, parent });
        else if (!SKIPPED_ELEMENTS.has(node.tagName ?? "")) collect(node);
      }
    })(tree);

    const matches = findQuoteMatches(
      threads,
      textNodes.map(({ node }) => node.value ?? ""),
    );

    for (const [segment, segmentMatches] of Map.groupBy(matches, ({ segment }) => segment)) {
      const { node, parent } = textNodes[segment];
      const value = node.value ?? "";
      const pieces: HastNode[] = [];
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
      parent.children!.splice(parent.children!.indexOf(node), 1, ...pieces);
    }
  };
}
