import { WidgetDefinition } from "./types";
import espnWidget from "./widgets/ESPN";
import hackerNewsWidget from "./widgets/HackerNews";
import onThisDayWidget from "./widgets/OnThisDay";
import redditWidget from "./widgets/Reddit";
import weatherWidget from "./widgets/Weather";
import nasaApodWidget from "./widgets/NasaApod";
import aiWidget from "./widgets/AI";

const widgetRegistry = {
  weather: weatherWidget,
  hackernews: hackerNewsWidget,
  onthisday: onThisDayWidget,
  espnnews: espnWidget,
  reddit: redditWidget,
  nasaapod: nasaApodWidget,
  ai: aiWidget,
};

export function getWidget(id: string): WidgetDefinition | undefined {
  return widgetRegistry[id];
}

export function getAllWidgets(): WidgetDefinition[] {
  return Object.values(widgetRegistry);
}

export function getAllWidgetTypes(): { type: string; name: string }[] {
  return Object.entries(widgetRegistry).map(([type, widget]) => ({
    type,
    name: widget.name,
  }));
}

export function getDefaultWidgets(): { id: string; type: string; name: string; collapsed: boolean; config?: Record<string, string> }[] {
  const defaultWidgetTypes = ["weather", "hackernews"];

  return defaultWidgetTypes.map(type => {
    const widgetDef = widgetRegistry[type];
    if (!widgetDef) return null;

    // Create default config from widget's config options with default values
    let defaultConfig: Record<string, string> | undefined;
    if (widgetDef.config) {
      defaultConfig = {};
      widgetDef.config.forEach((opt) => {
        if (opt.default !== undefined) {
          defaultConfig![opt.id] = String(opt.default);
        }
      });
      // Only set config if there are default values
      if (Object.keys(defaultConfig).length === 0) {
        defaultConfig = undefined;
      }
    }

    return {
      id: type, // Using type as initial ID for default widgets
      type,
      name: widgetDef.name,
      collapsed: false,
      config: defaultConfig,
    };
  }).filter((w): w is NonNullable<typeof w> => w !== null);
}