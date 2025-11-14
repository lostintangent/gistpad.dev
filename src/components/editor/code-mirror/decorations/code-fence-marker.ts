import { Extension } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";

interface FenceConfig {
    type: string;
    color: string;
}

// Configurable widget for different fence types
class CodeFenceWidget extends WidgetType {
    constructor(readonly content: string, readonly config: FenceConfig) {
        super();
    }

    eq(other: CodeFenceWidget) {
        return other.content === this.content && other.config.type === this.config.type;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = `cm-code-fence cm-${this.config.type}-fence`;
        span.textContent = this.config.type;

        // Add inline style for the background color
        span.style.background = this.config.color;

        return span;
    }
}

function createCodeFencePlugin(configs: FenceConfig[]) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.createDecorations(view);
            }

            createDecorations(view: EditorView) {
                const decorations = [];

                for (let i = 1; i <= view.state.doc.lines; i++) {
                    const line = view.state.doc.line(i);
                    const text = line.text;

                    // Check for each fence type
                    for (const config of configs) {
                        // Allow whitespace before the backticks in both opening and closing fences
                        const openFenceRegex = new RegExp(`^\\s*\`\`\`${config.type}\\s*$`);
                        if (openFenceRegex.test(text)) {
                            let endLine = i;
                            let content = "";
                            let foundClosing = false;
                            
                            // Find the end of the code fence (allowing whitespace before backticks)
                            for (let j = i + 1; j <= view.state.doc.lines; j++) {
                                const currentLine = view.state.doc.line(j);
                                // Check for closing fence with optional whitespace before the backticks
                                if (/^\s*```\s*$/.test(currentLine.text)) {
                                    endLine = j;
                                    foundClosing = true;
                                    break;
                                }
                                content += currentLine.text + "\n";
                            }

                            // Only decorate if we found a closing fence
                            if (foundClosing) {
                                // Add widget at the start
                                decorations.push(
                                    Decoration.widget({
                                        widget: new CodeFenceWidget(content.trim(), config),
                                        side: 1
                                    }).range(line.from)
                                );

                                // Mark each line in the fence for hiding
                                for (let j = i; j <= endLine; j++) {
                                    const currentLine = view.state.doc.line(j);
                                    decorations.push(
                                        Decoration.replace({}).range(currentLine.from, currentLine.to)
                                    );
                                }

                                i = endLine; // Skip to end of fence
                                break; // Exit the config loop once we've found a match
                            }
                        }
                    }
                }

                return Decoration.set(decorations, true);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.createDecorations(update.view);
                }
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    );
}

export function codeFenceMarker(configs: FenceConfig[] = []): Extension {
    // Default configurations if none provided
    if (configs.length === 0) {
        configs = [
            { type: "tldraw", color: "purple" },
            { type: "toc", color: "blue" }
        ];
    }

    return [createCodeFencePlugin(configs)];
}