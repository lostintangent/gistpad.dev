import { hoverTooltip } from "@codemirror/view";

// Matches both markdown image syntax ![alt](url) and HTML img tags <img src="url" ...>
const markdownImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
const htmlImagePattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;

function createTooltip(url: string) {
    const tooltip = document.createElement("div");
    tooltip.className = "cm-image-preview-tooltip";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Preview";
    img.style.maxWidth = "300px";
    img.style.height = "auto";
    tooltip.appendChild(img);
    return tooltip;
}

function imagePreviewTooltip() {
    return hoverTooltip((view, pos, side) => {
        const { from, to, text } = view.state.doc.lineAt(pos);
        let match;

        // Reset both patterns before using them
        markdownImagePattern.lastIndex = 0;
        htmlImagePattern.lastIndex = 0;

        // Check for markdown images
        while ((match = markdownImagePattern.exec(text))) {
            const [_, alt, url] = match;
            const urlStart = from + match.index + match[0].indexOf(url);
            const urlEnd = urlStart + url.length;
            if (pos >= urlStart && pos <= urlEnd) {
                return {
                    pos: urlStart,
                    end: urlEnd,
                    above: false,
                    create() {
                        return { dom: createTooltip(url) };
                    },
                };
            }
        }

        // Check for HTML images
        while ((match = htmlImagePattern.exec(text))) {
            const srcMatch = match[0].match(/src=["']([^"']+)["']/);
            if (!srcMatch) continue;
            const url = srcMatch[1];
            const urlStart = from + match.index + match[0].indexOf(url);
            const urlEnd = urlStart + url.length;
            if (pos >= urlStart && pos <= urlEnd) {
                return {
                    pos: urlStart,
                    end: urlEnd,
                    above: false,
                    create() {
                        return { dom: createTooltip(url) };
                    },
                };
            }
        }
        return null;
    });
}

export const imagePreview = () => imagePreviewTooltip();
