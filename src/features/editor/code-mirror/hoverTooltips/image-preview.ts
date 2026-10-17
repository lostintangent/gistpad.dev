import { hoverTooltip } from "@codemirror/view";

// Matches both markdown image syntax ![alt](url) and HTML img tags <img src="url" ...>
const markdownImagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
const htmlImagePattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;

export const imagePreview = hoverTooltip((view, pos) => {
  const { from, text } = view.state.doc.lineAt(pos);
  const images = [
    ...Array.from(text.matchAll(markdownImagePattern), (match) => ({ match, url: match[1] })),
    ...Array.from(text.matchAll(htmlImagePattern), (match) => ({
      match,
      // (The tag's first `src=` is used, rather than the pattern's greedy last one)
      url: match[0].match(/src=["']([^"']+)["']/)![1],
    })),
  ];

  for (const { match, url } of images) {
    const urlStart = from + match.index + match[0].indexOf(url);
    const urlEnd = urlStart + url.length;
    if (pos < urlStart || pos > urlEnd) continue;

    return {
      pos: urlStart,
      end: urlEnd,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-image-preview-tooltip";
        const img = dom.appendChild(document.createElement("img"));
        img.src = url;
        img.alt = "Preview";
        return { dom };
      },
    };
  }

  return null;
});
