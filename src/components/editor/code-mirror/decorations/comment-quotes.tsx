import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GistComment } from "@/lib/github";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    hoverTooltip,
} from "@codemirror/view";
import { createRoot } from "react-dom/client";

// This plugin will highlight text that is quoted in comments
// and make it clickable to open the comments panel and select the comment
export const commentQuotes = (
    comments: GistComment[] = [],
    selectComment: (commentId: number) => void,
    selectedCommentId: number | null = null,
    showInlineComments: boolean = true
): Extension => {
    // Helper function to create markdown tooltip DOM
    const createMarkdownTooltip = (comment: GistComment) => {
        const tooltip = document.createElement("div");
        tooltip.className = "cm-comment-tooltip";

        // Create a root for React rendering
        const root = createRoot(tooltip);

        // Get comment body without the blockquote
        const commentLines = comment.body.split("\n");
        const bodyWithoutQuote = commentLines
            .slice(1) // Skip the first line which contains the blockquote
            .join("\n")
            .trim();

        // Add author info and render markdown
        root.render(
            <>
                <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                        <AvatarImage src={comment.user?.avatar_url} />
                        <AvatarFallback>
                            {comment.user?.login[0].toUpperCase() ?? "A"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-sm font-bold">
                        {comment.user?.login || "Anonymous"}
                    </div>
                </div>
                <div className="mt-1">
                    <MarkdownPreview enableBlockquoteCopying={false}>{bodyWithoutQuote}</MarkdownPreview>
                </div>
            </>
        );

        return tooltip;
    };

    // Main plugin that handles highlighting quoted text
    const highlightPlugin = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view, comments);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view, comments);
                }
            }

            buildDecorations(view: EditorView, comments: GistComment[]) {
                const builder = new RangeSetBuilder<Decoration>();

                if (
                    !comments.length ||
                    (!showInlineComments && selectedCommentId === null)
                )
                    return builder.finish();

                const filteredComments = showInlineComments
                    ? comments
                    : comments.filter((comment) => comment.id === selectedCommentId);

                const commentsWithBlockquotes = filteredComments.filter((comment) => {
                    const firstLine = comment.body.split("\n")[0];
                    return firstLine.trim().startsWith(">");
                });

                if (!commentsWithBlockquotes.length) return builder.finish();

                const matches: Array<{
                    start: number;
                    end: number;
                    comment: GistComment;
                    decoration: Decoration;
                }> = [];

                for (const comment of commentsWithBlockquotes) {
                    const firstLine = comment.body.split("\n")[0];
                    const quotedText = firstLine.trim().substring(1).trim();

                    if (quotedText.length < 3) continue;

                    const docText = view.state.doc.toString();
                    let matchCount = 0;
                    let lastMatchPos = 0;

                    // Escape special regex characters in quotedText
                    const escapedQuotedText = quotedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Create a regex with word boundaries
                    const regex = new RegExp(`\\b${escapedQuotedText}\\b`, "g");
                    let match: RegExpExecArray | null;

                    while ((match = regex.exec(docText)) !== null) {
                        matchCount++;
                        lastMatchPos = match.index;
                    }

                    if (matchCount === 1) {
                        const start = lastMatchPos;
                        const end = lastMatchPos + quotedText.length;

                        matches.push({
                            start,
                            end,
                            comment,
                            decoration: Decoration.mark({
                                class: `cm-comment-quote${selectedCommentId === comment.id ? " selected" : ""}`,
                                attributes: {
                                    "data-comment-id": comment.id.toString(),
                                    role: "button",
                                    tabindex: "0",
                                    "aria-label": "Open comment",
                                },
                            }),
                        });
                    }
                }

                matches.sort((a, b) => a.start - b.start);

                for (const match of matches) {
                    builder.add(match.start, match.end, match.decoration);
                }

                return builder.finish();
            }
        },
        {
            decorations: (v) => v.decorations,
            eventHandlers: {
                click(e: MouseEvent, view: EditorView) {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains("cm-comment-quote")) {
                        const commentId = target.getAttribute("data-comment-id");
                        if (commentId) {
                            selectComment(Number(commentId));
                        }
                    }
                },
            },
        }
    );

    // Hover tooltip extension that shows the rendered markdown
    const tooltipExtension = hoverTooltip((view, pos, side) => {
        const decorations = (
            view.plugin(highlightPlugin)?.decorations || Decoration.none
        ).update({
            filter: (from, to) => pos >= from && pos <= to,
        });
        if (!decorations.size) return null;

        // Get an iterator over the decorations
        const iter = decorations.iter();
        // The cursor is already at the first decoration if it exists
        if (!iter.value) return null;

        const commentId = iter.value.spec.attributes?.["data-comment-id"];
        const comment = comments.find((c) => c.id.toString() === commentId);
        if (!comment) return null;

        return {
            pos: iter.from,
            end: iter.to,
            placement: "above" as const, // Force placement above
            create() {
                return { dom: createMarkdownTooltip(comment) };
            },
        };
    });

    return [highlightPlugin, tooltipExtension];
};
