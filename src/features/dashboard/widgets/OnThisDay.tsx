import { format } from "date-fns";
import { Skeleton } from "@/shared/ui/skeleton";
import { WidgetDefinition, WidgetProps } from "../types";

interface EventItem {
  text: string;
  year: number;
  pages: { content_urls: { desktop: { page: string } } }[];
}

// Wikipedia's feed API (which allows cross-origin requests, so it doesn't need a CORS proxy)
async function fetchData(): Promise<EventItem[]> {
  const date = format(new Date(), "MM/dd");
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${date}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }
  const { events }: { events: EventItem[] } = await response.json();

  // (Events are listed newest first, so this shows the 10 oldest, in chronological order)
  return events.slice(-10).reverse();
}

function OnThisDayWidget({ data }: WidgetProps<EventItem[]>) {
  if (!data) {
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
          <p className="prose prose-neutral dark:prose-invert text-sm">
            <a
              href={event.pages[0]?.content_urls.desktop.page}
              target="_blank"
              rel="noopener noreferrer"
            >
              {event.year}
            </a>{" "}
            – {event.text}
          </p>
          {index < data.length - 1 && <hr className="mt-3 border-border" />}
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
  // (Today's article on Wikipedia, e.g. "October 17", whose events are the ones that the feed lists)
  getExternalUrl: () => `https://en.wikipedia.org/wiki/${format(new Date(), "MMMM_d")}#Events`,
} satisfies WidgetDefinition<EventItem[]>;
