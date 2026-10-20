import { persistedAtom } from "@/shared/persistedAtom";
import { getRequiredOptions, isConfigured, widgetRegistry } from "./registry";
import type { WidgetState } from "./types";

function createWidget(type: string, id: string = crypto.randomUUID()): WidgetState {
  const defaults = (widgetRegistry[type].config ?? []).flatMap((option) =>
    option.default === undefined ? [] : [[option.id, String(option.default)]],
  );

  return { id, type, config: Object.fromEntries(defaults) };
}

/** The widgets on the dashboard (skipping any whose type no longer exists, e.g. Reddit or AI). */
export const widgetsAtom = persistedAtom<WidgetState[]>(
  "gistpad-widget-config",
  ["weather", "hackernews", "nasaapod"].map((type) => createWidget(type, type)),
  {
    parse: (value) =>
      (JSON.parse(value) as WidgetState[]).filter(({ type }) => widgetRegistry[type]),
    stringify: JSON.stringify,
  },
);

/** Adds a widget to the top of the dashboard (like a new gist, at the top of the gist list). */
export function addWidget(type: string) {
  const widget = createWidget(type);
  widgetsAtom.set((widgets) => [widget, ...widgets]);
  return widget;
}

export const updateWidget = (id: string, changes: Partial<WidgetState>) =>
  widgetsAtom.set((widgets) =>
    widgets.map((widget) => (widget.id === id ? { ...widget, ...changes } : widget)),
  );

/** Moves a widget to a new position in the list. */
export const moveWidget = (id: string, toIndex: number) =>
  widgetsAtom.set((widgets) => {
    const widget = widgets.find((widget) => widget.id === id)!;
    return widgets.filter((widget) => widget.id !== id).toSpliced(toIndex, 0, widget);
  });

export const removeWidget = (id: string) =>
  widgetsAtom.set((widgets) => widgets.filter((widget) => widget.id !== id));

/** Removes widgets that weren't configured (e.g. a new ESPN widget that wasn't given a sport). */
export const removeUnconfiguredWidgets = () =>
  widgetsAtom.set((widgets) =>
    widgets.filter((widget) => isConfigured(widgetRegistry[widget.type], widget.config)),
  );

/** Sets a widget's config, unless it would duplicate another widget's (e.g. the same sport). */
export function configureWidget({ id, type }: WidgetState, config: Record<string, string>) {
  const requiredOptions = getRequiredOptions(widgetRegistry[type]);
  const isDuplicate = widgetsAtom
    .get()
    .some(
      (other) =>
        other.id !== id &&
        other.type === type &&
        requiredOptions.every((option) => other.config?.[option.id] === config[option.id]),
    );

  if (isDuplicate) return "Widget already exists with this configuration";
  updateWidget(id, { config });
}
