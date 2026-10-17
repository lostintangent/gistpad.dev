import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import { decorationsPlugin } from "./plugin";

const supabaseUrlRegex = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/[^"\s)>]+/g;

const toggleUrlEffect = StateEffect.define<string>();

// Track expanded URLs in the editor state
const expandedUrlsState = StateField.define<Set<string>>({
  create: () => new Set(),
  update(urls, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleUrlEffect)) {
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
    button.className = "cm-supabase-url";
    button.textContent = this.expanded ? this.url : "...";
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: toggleUrlEffect.of(this.url) });
    };
    return button;
  }
}

const urlShortenerPlugin = decorationsPlugin(
  ({ state, visibleRanges }) => {
    const expandedUrls = state.field(expandedUrlsState);
    const decorations = [];
    for (const { from, to } of visibleRanges) {
      for (const { 0: url, index } of state.doc.sliceString(from, to).matchAll(supabaseUrlRegex)) {
        const start = from + index;
        const widget = new UrlWidget(url, expandedUrls.has(url));
        decorations.push(Decoration.replace({ widget }).range(start, start + url.length));
      }
    }
    return Decoration.set(decorations);
  },
  (update) =>
    update.docChanged ||
    update.viewportChanged ||
    update.transactions.some((tr) => tr.effects.some((e) => e.is(toggleUrlEffect))),
);

export const assetUrlShortener = [expandedUrlsState, urlShortenerPlugin];
