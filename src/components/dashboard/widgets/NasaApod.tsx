import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { MediaItem, WidgetDefinition, WidgetProps } from "../types";

export interface ApodData {
  title: string;
  explanation: string;
  url: string;
  media_type: string;
  thumbnail_url?: string;
}

async function fetchData(): Promise<ApodData> {
  const response = await fetch(
    "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true"
  );

  if (!response.ok) {
    throw new Error("Failed to fetch NASA picture of the day");
  }

  return response.json();
}

export function NasaApodWidget({
  data,
  isLoading,
  displayMediaDialog,
}: WidgetProps<ApodData>) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-60 w-full rounded-md" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  const imageUrl =
    data.media_type === "video" ? data.thumbnail_url || data.url : data.url;

  const handleImageClick = () => {
    if (data.media_type === "video") {
      const media: MediaItem = {
        type: "video",
        url: data.url,
        posterUrl: data.thumbnail_url
      };
      displayMediaDialog(media);
    } else {
      displayMediaDialog(imageUrl);
    }
  };

  return (
    <div>
      {data.media_type !== "other" ? (
        <>
          <img
            src={imageUrl}
            alt={data.title}
            className="w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
            onClick={handleImageClick}
          />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center justify-between w-full hover:bg-muted/50 rounded-md p-1 mt-2 transition-all ${!isExpanded ? 'mb-[-5px]' : 'mb-0'}`}
            title={isExpanded ? "Hide explanation" : "Show explanation"}
          >
            <h3 className="text-lg font-semibold">{data.title}</h3>
            <span className="text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-96" : "max-h-0"}`}
          >
            <p className="text-sm text-muted-foreground mt-1">
              {data.explanation}
            </p>
          </div>
        </>
      ) : (
        <a
          href="https://apod.nasa.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full p-4 text-center bg-muted/50 rounded-md hover:bg-muted transition-colors"
        >
          View on NASA APOD website →
        </a>
      )}
    </div>
  );
}

export default {
  name: "NASA Daily Picture",
  fetchData,
  component: NasaApodWidget,
  staleTime: 1000 * 60 * 60 * 8,
  getExternalUrl: () => "https://apod.nasa.gov",
} as WidgetDefinition<ApodData>;
