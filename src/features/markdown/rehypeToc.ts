// A rehype plugin that replaces ```toc code blocks with a table of contents for the document.
// It runs after `rehype-slug`, so that each heading already has the ID that its link targets.

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const HEADING = /^h([1-6])$/;

const textContent = (node: HastNode): string =>
  node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textContent).join("");

const isTocBlock = (node: HastNode) =>
  node.tagName === "pre" &&
  node.children?.some(
    (child) =>
      child.tagName === "code" &&
      (child.properties?.className as string[] | undefined)?.includes("language-toc"),
  );

export default function rehypeToc() {
  return (tree: HastNode) => {
    const headings: { id: string; text: string; level: number }[] = [];

    (function collect(node: HastNode) {
      const level = node.tagName?.match(HEADING)?.[1];
      const id = node.properties?.id;

      // Footnotes are rendered with a heading, which isn't part of the document's outline.
      if (level && typeof id === "string" && id !== "footnote-label") {
        headings.push({ id, text: textContent(node).trim(), level: Number(level) });
      }

      node.children?.forEach(collect);
    })(tree);

    const toc: HastNode = {
      type: "element",
      tagName: "div",
      properties: { className: ["markdown-toc"] },
      children: [
        {
          type: "element",
          tagName: "ul",
          properties: { className: ["list-none", "pl-0"] },
          children: headings.map(({ id, text, level }) => ({
            type: "element",
            tagName: "li",
            properties: { className: ["pl-4"], style: `margin-left: ${level - 1}rem` },
            children: [
              {
                type: "element",
                tagName: "a",
                properties: { href: `#${id}` },
                children: [{ type: "text", value: text }],
              },
            ],
          })),
        },
      ],
    };

    (function replace(node: HastNode) {
      node.children = node.children?.map((child) => (isTocBlock(child) ? toc : child));
      node.children?.forEach(replace);
    })(tree);
  };
}
