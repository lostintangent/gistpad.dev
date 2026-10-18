import type { WidgetDefinition, WidgetState } from "./types";
import espnWidget from "./widgets/ESPN";
import hackerNewsWidget from "./widgets/HackerNews";
import onThisDayWidget from "./widgets/OnThisDay";
import weatherWidget from "./widgets/Weather";
import nasaApodWidget from "./widgets/NasaApod";

export const widgetRegistry: Record<string, WidgetDefinition> = {
  weather: weatherWidget,
  hackernews: hackerNewsWidget,
  onthisday: onThisDayWidget,
  espnnews: espnWidget,
  nasaapod: nasaApodWidget,
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
