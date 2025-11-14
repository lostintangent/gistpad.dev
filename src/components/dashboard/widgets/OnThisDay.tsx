import { Skeleton } from "@/components/ui/skeleton";
import { WidgetDefinition, WidgetProps } from "../types";

export interface EventItem {
  text: string;
  html: string;
}


async function fetchData(): Promise<EventItem[]> {
  const endpoint = "https://today.zenquotes.io/api";
  const response = await fetch(
    `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }
  const data = await response.json();
  return data.data?.Events?.slice(0, 10) || [];
}

export function OnThisDayWidget({ data, isLoading }: WidgetProps<EventItem[]>) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(10)].map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((event, index) => (
        <div key={index}>
          <div
            className="prose dark:prose-invert text-sm"
            dangerouslySetInnerHTML={{
              __html: event.html.replace(
                /<a /g,
                '<a target="_blank" rel="noopener noreferrer" '
              ),
            }}
          />
          {index < data.length - 1 && (
            <hr className="mt-3 border-border" />
          )}
        </div>
      ))}
    </div>
  );
}

export default {
  name: "On This Day",
  fetchData,
  component: OnThisDayWidget,
  staleTime: 1000 * 60 * 60 * 8,
} as WidgetDefinition<EventItem[]>;
