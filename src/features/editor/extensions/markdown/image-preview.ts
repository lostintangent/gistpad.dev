import { EditorView, hoverTooltip } from "@codemirror/view";

// Matches both markdown image syntax ![alt](url) and HTML img tags <img src="url" ...>
const markdownImagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
const htmlImagePattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;

const theme = EditorView.baseTheme({
  ".cm-image-preview-tooltip": {
    background: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "4px",
    pointerEvents: "none",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  },
  ".cm-image-preview-tooltip img": {
    display: "block",
    maxWidth: "300px",
    height: "auto",
    margin: "0 auto",
  },
});

/** Previews an image when its URL is hovered. */
export const imagePreview = [
  hoverTooltip((view, pos) => {
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
  }),
  theme,
];
