import type { WidgetDefinition } from "./types";
import espnWidget from "./widgets/ESPN";
import hackerNewsWidget from "./widgets/HackerNews";
import onThisDayWidget from "./widgets/OnThisDay";
import weatherWidget from "./widgets/Weather";
import nasaApodWidget from "./widgets/NasaApod";
import aiWidget from "./widgets/AI";

/** A widget on the user's dashboard (which is persisted in localStorage). */
export interface WidgetState {
  id: string;
  type: string;
  collapsed?: boolean;
  config?: Record<string, string>;
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  weather: weatherWidget,
  hackernews: hackerNewsWidget,
  onthisday: onThisDayWidget,
  espnnews: espnWidget,
  nasaapod: nasaApodWidget,
  ai: aiWidget,
};

/** The config options that the user has to set (i.e. the ones without a default value). */
export function getRequiredOptions(definition: WidgetDefinition) {
  return definition.config?.filter((option) => option.default === undefined) ?? [];
}

/** Whether a widget's required config options have values (which it needs in order to load). */
export function isConfigured(definition: WidgetDefinition, config?: Record<string, string>) {
  return getRequiredOptions(definition).every((option) => config?.[option.id]?.trim());
}

/** A widget's name, along with the value of its first required option (e.g. "ESPN News (NFL)"). */
export function getWidgetTitle({ type, config }: WidgetState) {
  const { name } = widgetRegistry[type];
  const [titleOption] = getRequiredOptions(widgetRegistry[type]);
  const value = titleOption && config?.[titleOption.id];
  return value ? `${name} (${value})` : name;
}

export function createWidget(type: string, id: string = crypto.randomUUID()): WidgetState {
  const defaults = (widgetRegistry[type].config ?? []).flatMap((option) =>
    option.default === undefined ? [] : [[option.id, String(option.default)]],
  );

  return { id, type, config: Object.fromEntries(defaults) };
}

export function getDefaultWidgets() {
  return ["weather", "hackernews"].map((type) => createWidget(type, type));
}
