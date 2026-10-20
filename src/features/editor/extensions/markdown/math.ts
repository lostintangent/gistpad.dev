import { evaluateMathExpression, extractVariableAssignments } from "@/shared/calculations";
import { Decoration, WidgetType } from "@codemirror/view";
import { decorationsPlugin } from "../decorations-plugin";

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

/** Shows the result of each line that ends with an equals sign (e.g. `2 + 3 =`), after it. */
export const mathResults = decorationsPlugin(({ state: { doc } }) => {
  const decorations = [];
  let previousResult: string | null = null;
  const namedResults = new Map<string, string>();

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);

    const assignments = extractVariableAssignments(line.text);
    if (assignments.size > 0) {
      for (const [variable, value] of assignments) namedResults.set(variable, value);
      continue;
    }

    const match = line.text.match(/(?:\s*[-*]\s+)?(?:([^:]+):\s*)?([-+*/().\d\s,$a-zA-Z_-]+)=\s*$/);
    if (!match) continue;

    const [, name, expr] = match;
    const result = evaluateMathExpression(expr, previousResult, namedResults);
    if (result === null) continue;

    previousResult = result;
    if (name) {
      const trimmedName = name.trim();
      namedResults.set(trimmedName, result);
      namedResults.set(trimmedName.replace(/\s+/g, "-"), result);
    }

    // Hide any whitespace after the "=", and show the result in its place
    const from = line.from + line.text.lastIndexOf("=") + 1;
    if (from < line.to) decorations.push(Decoration.replace({}).range(from, line.to));
    decorations.push(
      Decoration.widget({ widget: new EquationResultWidget(result), side: 1 }).range(from),
    );
  }

  return Decoration.set(decorations, true);
});
