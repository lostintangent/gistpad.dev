import { evaluateMathExpression, extractVariableAssignments } from "@/shared/utils";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, WidgetType } from "@codemirror/view";
import { decorationsPlugin } from "./plugin";

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

export const mathEquationResult = decorationsPlugin(({ state: { doc } }) => {
  const decorations: { from: number; to: number; decoration: Decoration }[] = [];
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
    decorations.push(
      { from, to: line.to, decoration: Decoration.replace({}) },
      {
        from,
        to: from,
        decoration: Decoration.widget({ widget: new EquationResultWidget(result), side: 1 }),
      },
    );
  }

  // Decorations are sorted by position, and then by side (so empty replacements come before
  // widgets). They're added with a builder, since `Decoration.range()` rejects empty replacements.
  const builder = new RangeSetBuilder<Decoration>();
  decorations
    .sort(
      (a, b) =>
        a.from - b.from ||
        a.to - b.to ||
        (a.decoration.spec.side ?? 0) - (b.decoration.spec.side ?? 0),
    )
    .forEach(({ from, to, decoration }) => builder.add(from, to, decoration));
  return builder.finish();
});
