import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { decorationsPlugin } from "../decorations-plugin";

// The URLs of uploaded assets (e.g. images) are long, so they're shortened to a button that
// expands them (and collapses them again)

const assetUrlPattern = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/[^"\s)>]+/g;

const toggleUrl = StateEffect.define<string>();

/** The URLs that are expanded. */
const expandedUrls = StateField.define<Set<string>>({
  create: () => new Set(),
  update(urls, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleUrl)) {
        urls = new Set(urls);
        if (!urls.delete(effect.value)) urls.add(effect.value);
      }
    }
    return urls;
  },
});

class UrlWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly expanded: boolean,
  ) {
    super();
  }

  eq(other: UrlWidget) {
    return other.url === this.url && other.expanded === this.expanded;
  }

  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-asset-url";
    button.textContent = this.expanded ? this.url : "...";
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: toggleUrl.of(this.url) });
    };
    return button;
  }
}

const urlWidgets = decorationsPlugin(
  ({ state, visibleRanges }) => {
    const expanded = state.field(expandedUrls);
    const decorations = [];
    for (const { from, to } of visibleRanges) {
      for (const { 0: url, index } of state.doc.sliceString(from, to).matchAll(assetUrlPattern)) {
        const start = from + index;
        const widget = new UrlWidget(url, expanded.has(url));
        decorations.push(Decoration.replace({ widget }).range(start, start + url.length));
      }
    }
    return Decoration.set(decorations);
  },
  (update) =>
    update.docChanged ||
    update.viewportChanged ||
    update.transactions.some((tr) => tr.effects.some((e) => e.is(toggleUrl))),
);

const theme = EditorView.baseTheme({
  // (The button's font, margin and border are reset by Tailwind's preflight)
  ".cm-asset-url": {
    color: "var(--primary)",
    background: "var(--muted)",
    padding: "0 4px",
    borderRadius: "4px",
    userSelect: "none",
    WebkitUserSelect: "none",
    display: "inline",
    textAlign: "left",
    outline: "none",
  },
  ".cm-asset-url:hover": {
    background: "color-mix(in oklab, var(--accent) 50%, transparent)",
    textDecoration: "underline",
  },
});

export const assetUrls = [expandedUrls, urlWidgets, theme];
