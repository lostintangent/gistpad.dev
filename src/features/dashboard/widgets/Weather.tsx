import { Skeleton } from "@/shared/ui/skeleton";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplet,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { WidgetDefinition, WidgetProps } from "../types";

interface WeatherData {
  temperature: number;
  description: string;
  location: string;
  weatherCode: number;
  dailyHigh: number;
  dailyLow: number;
  sunrise: string;
  sunset: string;
  chanceOfRain: number;
  hourly: { time: string; temperature: number; precipitation: number }[];
}

// Open-Meteo's weather codes, grouped by the icons that represent them (where clear skies are the default)
const WEATHER_ICON_CODES: [LucideIcon, number[]][] = [
  [CloudSun, [2]], // Partly cloudy
  [Cloud, [3]], // Overcast
  [CloudFog, [45, 48]],
  [CloudRain, [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]], // Drizzle/rain
  [CloudSnow, [71, 73, 75, 77, 85, 86]],
  [CloudLightning, [95, 96, 99]], // Thunderstorm
];

const WEATHER_ICONS: Record<number, LucideIcon> = Object.fromEntries(
  WEATHER_ICON_CODES.flatMap(([icon, codes]) => codes.map((code) => [code, icon])),
);

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const formatTime = (time: string) =>
  new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

async function fetchData(): Promise<WeatherData> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject),
  );
  const { latitude, longitude } = position.coords;

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&hourly=temperature_2m,precipitation_probability&temperature_unit=fahrenheit&timezone=auto`,
  );
  if (!response.ok) throw new Error("Failed to fetch weather");
  const { current_weather, daily, hourly } = await response.json();

  // Get location name from reverse geocoding
  const geoResponse = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
  );
  const address = (await geoResponse.json()).address || {};
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    address.city_district ||
    address.county ||
    "Unknown";
  const state = address.state || address.region || address.state_district;

  // The hourly forecast for the next 12 hours
  const now = new Date();
  const startIndex = hourly.time.findIndex((time: string) => new Date(time) >= now);

  return {
    temperature: Math.round(current_weather.temperature),
    description: WEATHER_DESCRIPTIONS[current_weather.weathercode] || "Unknown",
    location: [city, state, address.country].filter(Boolean).join(", "),
    weatherCode: current_weather.weathercode,
    dailyHigh: Math.round(daily.temperature_2m_max[0]),
    dailyLow: Math.round(daily.temperature_2m_min[0]),
    sunrise: formatTime(daily.sunrise[0]).replace("AM", ""),
    sunset: formatTime(daily.sunset[0]).replace("PM", ""),
    chanceOfRain: daily.precipitation_probability_max[0] || 0,
    hourly: hourly.time.slice(startIndex, startIndex + 12).map((time: string, i: number) => ({
      time: new Date(time).toLocaleTimeString([], { hour: "numeric" }),
      temperature: Math.round(hourly.temperature_2m[startIndex + i]),
      precipitation: hourly.precipitation_probability[startIndex + i] ?? 0,
    })),
  };
}

// The widget pages between the current weather, and the forecast for the next 12 hours (6 at a time)
const HOURS_PER_PAGE = 6;
const PAGE_COUNT = 3;

function WeatherWidget({ data, config }: WidgetProps<WeatherData>) {
  const [page, setPage] = useState(0);

  if (!data) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  const WeatherIcon = WEATHER_ICONS[data.weatherCode] ?? Sun;

  const getTempColorClass = (temp: number) => {
    if (temp === data.dailyHigh) return "text-orange-300";
    if (temp === data.dailyLow) return "text-blue-300";
    return "text-muted-foreground";
  };

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex transition-transform duration-300"
        style={{ transform: `translateX(-${page * 100}%)` }}
      >
        <div className="flex items-center gap-4 w-full flex-shrink-0">
          <div className="w-16 h-16 flex items-center justify-center">
            <WeatherIcon className="w-12 h-12 text-blue-500" />
          </div>
          <div className="space-y-1">
            <p className="flex items-bottom align-bottom gap-2 font-bold">
              {data.temperature}°
              <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                <ArrowUp className="w-4 h-4" />
                {data.dailyHigh}°
              </span>
              <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                <ArrowDown className="w-4 h-4" />
                {data.dailyLow}°
              </span>
              {config.showChanceOfRain !== "false" && (
                <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                  <Droplet className="w-4 h-4" />
                  {data.chanceOfRain}%
                </span>
              )}
            </p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground capitalize">
              <span className="text-primary font-bold">{data.description}</span>
              {config.showSunriseSunset !== "false" && (
                <>
                  <span className="ml-2 flex items-center gap-1">
                    <Sunrise className="w-4 h-4" /> {data.sunrise}
                  </span>
                  <span className="ml-2 flex items-center gap-1">
                    <Sunset className="w-4 h-4" /> {data.sunset}
                  </span>
                </>
              )}
            </p>
            <p className="text-sm text-muted-foreground italic">{data.location}</p>
          </div>
        </div>

        {Array.from({ length: PAGE_COUNT - 1 }, (_, hourlyPage) => (
          <div key={hourlyPage} className="w-full flex-shrink-0 flex items-center">
            <div className="flex-1 grid grid-cols-6 text-center text-xs gap-2 px-6">
              {data.hourly
                .slice(hourlyPage * HOURS_PER_PAGE, (hourlyPage + 1) * HOURS_PER_PAGE)
                .map((hour, i) => (
                  <div key={i} className="space-y-1">
                    <div className="font-medium text-primary">{hour.time}</div>
                    <div className={getTempColorClass(hour.temperature)}>{hour.temperature}°</div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <span className="italic">{hour.precipitation}%</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {page > 0 && (
        <button
          onClick={() => setPage(page - 1)}
          className="absolute left-0 top-1/2 -translate-y-1/2"
          aria-label={page === 1 ? "Show current weather" : "Show previous 6 hours"}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {page < PAGE_COUNT - 1 && (
        <button
          onClick={() => setPage(page + 1)}
          className="absolute right-0 top-1/2 -translate-y-1/2"
          aria-label={page === 0 ? "Show hourly forecast" : "Show next 6 hours"}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default {
  name: "Weather",
  config: [
    { id: "showSunriseSunset", name: "Show sunrise/sunset?", default: true },
    { id: "showChanceOfRain", name: "Show chance of rain?", default: true },
  ],
  fetchData,
  component: WeatherWidget,
} satisfies WidgetDefinition<WeatherData>;
