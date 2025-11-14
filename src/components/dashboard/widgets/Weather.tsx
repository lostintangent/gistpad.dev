import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { useState } from "react";
import { WidgetDefinition, WidgetProps } from "../types";

export interface HourlyForecast {
  time: string;
  temperature: number;
  precipitation: number;
}

export interface WeatherData {
  temperature: number;
  description: string;
  location: string;
  weatherCode: number;
  dailyHigh: number;
  dailyLow: number;
  sunrise: string;
  sunset: string;
  chanceOfRain: number;
  hourly: HourlyForecast[];
}

// Map Open-Meteo weather codes to Lucide icons
function getWeatherIcon(weatherCode: number) {
  switch (weatherCode) {
    case 0:
      return Sun; // Clear sky
    case 1:
      return Sun; // Mainly clear
    case 2:
      return CloudSun; // Partly cloudy
    case 3:
      return Cloud; // Overcast
    case 45:
    case 48:
      return CloudFog; // Foggy conditions
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return CloudRain; // Drizzle/Rain
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return CloudSnow; // Snow
    case 95:
    case 96:
    case 99:
      return CloudLightning; // Thunderstorm
    default:
      return Sun;
  }
}

async function fetchData(): Promise<WeatherData> {
  // Get user's location
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
  const { latitude, longitude } = position.coords;

  // Fetch weather data from Open-Meteo API
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&hourly=temperature_2m,precipitation_probability&temperature_unit=fahrenheit&timezone=auto`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch weather");
  }

  const data = await response.json();

  // Get location name from reverse geocoding
  const geoResponse = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
  );
  const geoData = await geoResponse.json();

  // Map weather codes to descriptions
  const weatherDescriptions: { [key: number]: string } = {
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

  // Build hourly forecast for the next 12 hours
  const now = new Date();
  const startIndex = data.hourly.time.findIndex(
    (t: string) => new Date(t) >= now
  );
  const hourly: HourlyForecast[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = startIndex + i;
    if (idx >= data.hourly.time.length) break;
    hourly.push({
      time: new Date(data.hourly.time[idx]).toLocaleTimeString([], {
        hour: "numeric",
      }),
      temperature: Math.round(data.hourly.temperature_2m[idx]),
      precipitation: data.hourly.precipitation_probability[idx] ?? 0,
    });
  }

  const address = geoData.address || {};
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
  const country = address.country || "";

  return {
    temperature: Math.round(data.current_weather.temperature),
    description:
      weatherDescriptions[data.current_weather.weathercode] || "Unknown",
    location: [city, state, country].filter(Boolean).join(", "),
    weatherCode: data.current_weather.weathercode,
    dailyHigh: Math.round(data.daily.temperature_2m_max[0]),
    dailyLow: Math.round(data.daily.temperature_2m_min[0]),
    sunrise: new Date(data.daily.sunrise[0])
      .toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
      .replace("AM", ""),
    sunset: new Date(data.daily.sunset[0])
      .toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
      .replace("PM", ""),
    chanceOfRain: data.daily.precipitation_probability_max[0] || 0,
    hourly,
  };
}

export function WeatherWidget({
  data,
  isLoading,
  config,
}: WidgetProps<WeatherData>) {
  const [currentView, setCurrentView] = useState<
    "summary" | "hourly1" | "hourly2"
  >("summary");

  if (isLoading) {
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

  const WeatherIcon = getWeatherIcon(data.weatherCode);

  // Function to get temperature color class based on daily high/low
  const getTempColorClass = (temp: number) => {
    if (temp === data.dailyHigh) return "text-orange-300";
    if (temp === data.dailyLow) return "text-blue-300";
    return "text-muted-foreground";
  };

  const getTransformClass = () => {
    switch (currentView) {
      case "summary":
        return "translate-x-0";
      case "hourly1":
        return "-translate-x-full";
      case "hourly2":
        return "-translate-x-[200%]";
    }
  };

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className={`flex transition-transform duration-300 ${getTransformClass()}`}
      >
        {/* Main view */}
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
              {config?.showChanceOfRain !== "false" && (
                <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                  <Droplet className="w-4 h-4" />
                  {data.chanceOfRain}%
                </span>
              )}
            </p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground capitalize">
              <span className="text-primary font-bold">{data.description}</span>
              {config?.showSunriseSunset !== "false" && (
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
            <p className="text-sm text-muted-foreground italic">
              {data.location}
            </p>
          </div>
        </div>

        {/* Hourly view 1 (hours 0-5) */}
        <div className="w-full flex-shrink-0 flex items-center">
          <div className="flex-1 grid grid-cols-6 text-center text-xs gap-2 px-6">
            {data.hourly?.slice(0, 6).map((h, i) => (
              <div key={i} className="space-y-1">
                <div className="font-medium text-primary">{h.time}</div>
                <div className={getTempColorClass(h.temperature)}>{h.temperature}°</div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <span className="italic">{h.precipitation}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly view 2 (hours 6-11) */}
        <div className="w-full flex-shrink-0 flex items-center">
          <div className="flex-1 grid grid-cols-6 text-center text-xs gap-2 px-6">
            {data.hourly?.slice(6, 12).map((h, i) => (
              <div key={i} className="space-y-1">
                <div className="font-medium text-primary">{h.time}</div>
                <div className={getTempColorClass(h.temperature)}>{h.temperature}°</div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <span className="italic">{h.precipitation}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {currentView === "summary" && (
        <button
          onClick={() => setCurrentView("hourly1")}
          className="absolute right-0 top-1/2 -translate-y-1/2"
          aria-label="Show hourly forecast"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {currentView === "hourly1" && (
        <>
          <button
            onClick={() => setCurrentView("summary")}
            className="absolute left-0 top-1/2 -translate-y-1/2"
            aria-label="Show current weather"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentView("hourly2")}
            className="absolute right-0 top-1/2 -translate-y-1/2"
            aria-label="Show next 6 hours"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {currentView === "hourly2" && (
        <button
          onClick={() => setCurrentView("hourly1")}
          className="absolute left-0 top-1/2 -translate-y-1/2"
          aria-label="Show previous 6 hours"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default {
  name: "Weather",
  config: [
    {
      id: "showSunriseSunset",
      name: "Show sunrise/sunset?",
      default: true,
    },
    {
      id: "showChanceOfRain",
      name: "Show chance of rain?",
      default: true,
    },
  ],
  fetchData,
  component: WeatherWidget,
} as WidgetDefinition<WeatherData>;
