import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

export async function markdownToHtml(markdown: string, copyToClipboard: boolean = true): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw) // For parsing raw HTML tags in content
    .use(rehypeSlug) // Add IDs to headings
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  const html = String(result);
  if (copyToClipboard) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  }
  return html;
}
