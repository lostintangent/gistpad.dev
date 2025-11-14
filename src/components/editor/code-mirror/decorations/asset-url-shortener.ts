import { Extension, StateEffect, StateField } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";

const supabaseUrlRegex =
    /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/[^"\s)>]+/g;

const toggleUrlEffect = StateEffect.define<string>();

// Track expanded URLs in the editor state
const expandedUrlsState = StateField.define<Set<string>>({
    create() {
        return new Set();
    },
    update(urls, tr) {
        urls = new Set(urls);
        for (const effect of tr.effects) {
            if (effect.is(toggleUrlEffect)) {
                const url = effect.value;
                if (urls.has(url)) {
                    urls.delete(url);
                } else {
                    urls.add(url);
                }
            }
        }
        return urls;
    },
});

class UrlWidget extends WidgetType {
    constructor(
        readonly url: string,
        readonly expanded: boolean
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
            view.dispatch({
                effects: toggleUrlEffect.of(this.url),
            });
            return false;
        };

        return button;
    }
}

const urlShortenerPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.createDecorations(view);
        }

        createDecorations(view: EditorView) {
            const expandedUrls = view.state.field(expandedUrlsState);
            const decorations = [];
            for (const { from, to } of view.visibleRanges) {
                const text = view.state.doc.sliceString(from, to);
                supabaseUrlRegex.lastIndex = 0;
                let match;
                while ((match = supabaseUrlRegex.exec(text))) {
                    const url = match[0];
                    const start = from + match.index;
                    const end = start + url.length;
                    decorations.push(
                        Decoration.replace({
                            widget: new UrlWidget(url, expandedUrls.has(url)),
                        }).range(start, end)
                    );
                }
            }
            return Decoration.set(decorations);
        }

        update(update: ViewUpdate) {
            if (
                update.docChanged ||
                update.viewportChanged ||
                update.transactions.some((tr) =>
                    tr.effects.some((e) => e.is(toggleUrlEffect))
                )
            ) {
                this.decorations = this.createDecorations(update.view);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

export const assetUrlShortener = (): Extension => [
    expandedUrlsState,
    urlShortenerPlugin,
];
