import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { decorationsPlugin } from "./plugin";

// URL regex pattern that matches http(s), file, and ftp protocols
const urlPattern = /\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|]/gi;

// Wikilink pattern that matches [[something]] (but not images ![[ ]])
const wikilinkPattern = /(?<!!)\[\[([^\]]+)\]\]/g;

const wikilinkBrackets = Decoration.mark({ class: "cm-wikilink-brackets" });

class LinkWidget extends WidgetType {
  constructor(private url: string) {
    super();
  }

  toDOM() {
    const link = document.createElement("a");
    link.href = this.url;
    link.textContent = this.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "cm-url-link";
    link.onclick = (e) => {
      e.preventDefault();
      window.open(this.url, "_blank");
    };
    return link;
  }

  eq(other: LinkWidget) {
    return other.url === this.url;
  }
}

const decorateLinks = (view: EditorView) => {
  const decorations = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    for (const { 0: url, index } of text.matchAll(urlPattern)) {
      const start = from + index;
      decorations.push(
        Decoration.replace({ widget: new LinkWidget(url) }).range(start, start + url.length),
      );
    }

    for (const { 0: match, 1: link, index } of text.matchAll(wikilinkPattern)) {
      const start = from + index;
      const end = start + match.length;
      decorations.push(
        wikilinkBrackets.range(start, start + 2),
        Decoration.mark({
          class: "cm-wikilink-content",
          // The link is stored as data (and handled by the event handlers below), since building
          // inline event handlers from document text would allow script injection.
          attributes: {
            role: "link",
            "aria-label": `Navigate to ${link}`,
            tabindex: "0",
            "data-wikilink": link,
          },
        }).range(start + 2, end - 2),
        wikilinkBrackets.range(end - 2, end),
      );
    }
  }

  return Decoration.set(decorations, true);
};

export const clickableLinks = (onWikilinkClick: (link: string) => void) => {
  const openWikilink = (e: Event) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>("[data-wikilink]");
    if (!link) return false;

    e.preventDefault();
    onWikilinkClick(link.dataset.wikilink!);
    return true;
  };

  return [
    decorationsPlugin(decorateLinks, (update) => update.docChanged || update.viewportChanged),
    EditorView.domEventHandlers({
      click: openWikilink,
      keydown: (e) => (e.key === "Enter" || e.key === " ") && openWikilink(e),
    }),
  ];
};
