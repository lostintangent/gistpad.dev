import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

// URLs (http(s), ftp and file), and wikilinks (i.e. [[page]], but not images ![[page]])
const linkPattern =
  /\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|]|(?<!!)\[\[([^\]]+)\]\]/gi;

const wikilinkBrackets = Decoration.mark({ class: "cm-wikilink-brackets" });

// Links are stored as data (and followed by the event handlers below), since building inline
// event handlers from document text would allow script injection.
const links = new MatchDecorator({
  regexp: linkPattern,
  decorate: (add, from, to, [url, wikilink]) => {
    if (wikilink === undefined) {
      add(from, to, Decoration.mark({ class: "cm-url-link", attributes: { "data-url": url } }));
      return;
    }

    add(from, from + 2, wikilinkBrackets);
    add(
      from + 2,
      to - 2,
      // (Styled like the preview's wikilinks, by the app)
      Decoration.mark({
        class: "wikilink",
        attributes: {
          role: "link",
          "aria-label": `Navigate to ${wikilink}`,
          tabindex: "0",
          "data-wikilink": wikilink,
        },
      }),
    );
    add(to - 2, to, wikilinkBrackets);
  },
});

const linkDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = links.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = links.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const theme = EditorView.baseTheme({
  ".cm-url-link": { color: "var(--primary)", textDecoration: "underline", cursor: "pointer" },
  ".cm-wikilink-brackets": { color: "var(--muted-foreground)" },
});

/** Makes the document's URLs and wikilinks clickable (the latter opening the gist's file). */
export const clickableLinks = (onWikilinkClick: (link: string) => void) => {
  const followLink = (event: Event) => {
    const link = (event.target as HTMLElement).closest<HTMLElement>("[data-url], [data-wikilink]");
    if (!link) return false;

    event.preventDefault();
    if (link.dataset.url) window.open(link.dataset.url, "_blank", "noopener,noreferrer");
    else onWikilinkClick(link.dataset.wikilink!);
    return true;
  };

  return [
    linkDecorations,
    theme,
    EditorView.domEventHandlers({
      click: followLink,
      keydown: (event) => (event.key === "Enter" || event.key === " ") && followLink(event),
    }),
  ];
};
