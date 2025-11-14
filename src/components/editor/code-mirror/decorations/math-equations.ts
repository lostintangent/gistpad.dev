import {
    evaluateMathExpression,
    extractVariableAssignments,
} from "@/lib/utils";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";

class EquationResultWidget extends WidgetType {
    constructor(private result: string) {
        super();
    }

    eq(other: EquationResultWidget) {
        return other.result === this.result;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = "text-black ml-1.5 rounded p-0.5 bg-amber-500";
        span.textContent = this.result;
        return span;
    }
}

const equationPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();

            // Collect all decorations first, then sort them
            const decorations: Array<{
                from: number;
                to: number;
                decoration: Decoration;
            }> = [];

            let previousResult: string | null = null;
            const namedResults: Map<string, string> = new Map();

            for (let i = 1; i <= view.state.doc.lines; i++) {
                const line = view.state.doc.line(i);
                const text = line.text;

                const assignments = extractVariableAssignments(text);
                if (assignments.size > 0) {
                    for (const [name, value] of assignments.entries()) {
                        namedResults.set(name, value);
                    }
                    continue;
                }

                const match = text.match(/(?:\s*[-*]\s+)?(?:([^:]+):\s*)?([-+*/().\d\s,\$a-zA-Z_-]+)=\s*$/);
                if (match) {
                    const nameCapture = match[1];
                    const expr = match[2];

                    const result = evaluateMathExpression(expr, previousResult, namedResults);
                    if (result !== null) {
                        previousResult = result;

                        if (nameCapture) {
                            const trimmedName = nameCapture.trim();
                            namedResults.set(trimmedName, result);
                            namedResults.set(trimmedName
                                .replace(/\s+/g, "-"), result);
                        }

                        const eqIndex = text.lastIndexOf("=");
                        const from = line.from + eqIndex + 1;

                        // Add replacement decoration (replaces the "=" and any trailing whitespace)
                        decorations.push({
                            from,
                            to: line.to,
                            decoration: Decoration.replace({}),
                        });

                        // Add widget decoration at the same position
                        decorations.push({
                            from,
                            to: from,
                            decoration: Decoration.widget({
                                widget: new EquationResultWidget(result),
                                side: 1,
                            }),
                        });
                    }
                }
            }

            // Sort decorations by from position, then by to position, then by side
            decorations.sort((a, b) => {
                if (a.from !== b.from) return a.from - b.from;
                if (a.to !== b.to) return a.to - b.to;
                // For decorations at the same position, widgets with side=1 should come after replacements
                const aSide = a.decoration.spec?.side ?? 0;
                const bSide = b.decoration.spec?.side ?? 0;
                return aSide - bSide;
            });

            // Add decorations to builder in sorted order
            for (const { from, to, decoration } of decorations) {
                builder.add(from, to, decoration);
            }

            return builder.finish();
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

export const mathEquationResult = (): Extension => [equationPlugin];
