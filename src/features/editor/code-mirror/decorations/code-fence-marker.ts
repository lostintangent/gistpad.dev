import { Decoration, WidgetType } from "@codemirror/view";
import { decorationsPlugin } from "./plugin";

interface FenceConfig {
  type: string;
  color: string;
}

// Configurable widget for different fence types
class CodeFenceWidget extends WidgetType {
  constructor(readonly config: FenceConfig) {
    super();
  }

  eq(other: CodeFenceWidget) {
    return other.config.type === this.config.type;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-code-fence";
    span.textContent = this.config.type;
    span.style.background = this.config.color;
    return span;
  }
}

export const codeFenceMarker = (configs: FenceConfig[]) =>
  decorationsPlugin(({ state: { doc } }) => {
    const decorations = [];

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);

      // Allow whitespace before the backticks in both opening and closing fences
      const config = configs.find(({ type }) =>
        new RegExp(`^\\s*\`\`\`${type}\\s*$`).test(line.text),
      );
      if (!config) continue;

      let end = i + 1;
      while (end <= doc.lines && !/^\s*```\s*$/.test(doc.line(end).text)) end++;

      // Only decorate if we found a closing fence
      if (end > doc.lines) continue;

      decorations.push(
        Decoration.widget({ widget: new CodeFenceWidget(config), side: 1 }).range(line.from),
      );

      // Hide each line in the fence, and then skip to the end of it
      for (let j = i; j <= end; j++) {
        const { from, to } = doc.line(j);
        decorations.push(Decoration.replace({}).range(from, to));
      }
      i = end;
    }

    return Decoration.set(decorations, true);
  });
