import { RangeSetBuilder } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    WidgetType,
} from "@codemirror/view";

// URL regex pattern that matches http(s), file, and ftp protocols
const urlPattern =
    /\b((?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

// Wikilink pattern that matches [[something]] (but not images ![[ ]])
const wikilinkPattern = /(?<!!)\[\[([^\]]+)\]\]/g;

class LinkWidget extends WidgetType {
    constructor(
        private url: string,
        private isWikilink: boolean = false,
        private onWikilinkClick?: (link: string) => void
    ) {
        super();
    }

    toDOM() {
        const link = document.createElement("a");
        link.href = this.isWikilink ? "#" : this.url;
        link.textContent = this.isWikilink ? this.url : this.url;
        link.target = this.isWikilink ? "_self" : "_blank";
        link.rel = "noopener noreferrer";
        link.className = this.isWikilink ? "cm-wikilink-link" : "cm-url-link";
        link.onclick = (e) => {
            e.preventDefault();
            if (this.isWikilink) {
                this.onWikilinkClick?.(this.url);
            } else {
                window.open(this.url, "_blank");
            }
        };
        return link;
    }

    eq(other: LinkWidget) {
        return other.url === this.url && other.isWikilink === this.isWikilink;
    }
}

export const clickableLinks = (onWikilinkClick?: (link: string) => void) =>
    ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: any) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view: EditorView) {
                const builder = new RangeSetBuilder<Decoration>();

                interface Range {
                    from: number;
                    to: number;
                    decoration: Decoration;
                }

                for (const { from, to } of view.visibleRanges) {
                    const text = view.state.doc.sliceString(from, to);
                    const ranges: Range[] = [];

                    // Collect URL ranges
                    let match;
                    while ((match = urlPattern.exec(text))) {
                        const start = from + match.index;
                        const url = match[0];
                        ranges.push({
                            from: start,
                            to: start + url.length,
                            decoration: Decoration.replace({
                                widget: new LinkWidget(url),
                            })
                        });
                    }

                    // Collect wikilink ranges
                    wikilinkPattern.lastIndex = 0; // Reset the regex index
                    while ((match = wikilinkPattern.exec(text))) {
                        const fullMatch = match[0];
                        const innerContent = match[1];
                        const matchStart = from + match.index;
                        const innerStart = matchStart + 2;

                        // Opening brackets
                        ranges.push({
                            from: matchStart,
                            to: matchStart + 2,
                            decoration: Decoration.mark({
                                class: "cm-wikilink-brackets",
                            })
                        });

                        // Inner content
                        ranges.push({
                            from: innerStart,
                            to: innerStart + innerContent.length,
                            decoration: Decoration.mark({
                                class: "cm-wikilink-content",
                                attributes: {
                                    role: "link",
                                    "aria-label": `Navigate to ${innerContent}`,
                                    tabindex: "0",
                                    onclick: `(function(e) { 
                    e.preventDefault(); 
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('wikilink-click', {
                      detail: { link: '${innerContent}' }
                    }));
                  })(event)`,
                                    onkeydown: `(function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('wikilink-click', {
                        detail: { link: '${innerContent}' }
                      }));
                    }
                  })(event)`,
                                },
                            })
                        });

                        // Closing brackets
                        ranges.push({
                            from: innerStart + innerContent.length,
                            to: innerStart + innerContent.length + 2,
                            decoration: Decoration.mark({
                                class: "cm-wikilink-brackets",
                            })
                        });
                    }

                    // Sort ranges by 'from' position and add them to the builder
                    ranges.sort((a, b) => a.from - b.from);
                    for (const range of ranges) {
                        builder.add(range.from, range.to, range.decoration);
                    }
                }

                return builder.finish();
            }
        },
        {
            decorations: (v) => v.decorations,
            eventHandlers: {
                click(e: MouseEvent, view: EditorView) {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains("cm-wikilink-content")) {
                        e.preventDefault();
                    }
                },
            },
        }
    );
