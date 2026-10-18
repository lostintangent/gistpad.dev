import { Skeleton } from "@/shared/ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Media, WidgetDefinition, WidgetProps } from "../types";

interface Apod {
  title: string;
  explanation: string;
  /** The day's page on NASA's website. */
  link: string;
  /** The day's picture (or video), unless it's hosted elsewhere (e.g. on YouTube). */
  media?: Media;
}

// APOD moved from apod.nasa.gov to NASA Science, whose (WordPress) API doesn't need a key, unlike
// api.nasa.gov's (whose demo key is quickly rate-limited). Each day's picture is a post in its APOD
// category, whose page leads with the picture, its title and its explanation.
const LATEST_POST_URL =
  "https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=1&_fields=link,content";

async function fetchData(): Promise<Apod> {
  const response = await fetch(LATEST_POST_URL);
  if (!response.ok) throw new Error("Failed to fetch NASA picture of the day");

  const [post]: { link: string; content: { rendered: string } }[] = await response.json();
  const page = new DOMParser().parseFromString(post.content.rendered, "text/html");
  const hero = page.querySelector(".hds-media-detail-hero");
  if (!hero) throw new Error("Failed to read NASA picture of the day");

  const video = hero.querySelector(".media-detail-hero__media video source")?.getAttribute("src");
  const image = hero.querySelector(".media-detail-hero__media img")?.getAttribute("src");
  const explanation = hero.querySelector(".media-detail-hero__description")?.textContent ?? "";

  return {
    title: hero.querySelector("h1")?.textContent?.trim() ?? "",
    explanation: explanation.replace(/\s+/g, " ").replace("Explanation:", "").trim(),
    link: post.link,
    media: video
      ? { type: "video", url: video }
      : image
        ? { type: "image", url: image }
        : undefined,
  };
}

const PREVIEW_CLASS = "w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity";

function NasaApodWidget({ data, displayMediaDialog }: WidgetProps<Apod>) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-60 w-full rounded-md" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  const { media } = data;
  return (
    <div>
      {media?.type === "video" ? (
        <video
          // (Showing its first frame, since it doesn't have a poster)
          src={`${media.url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className={PREVIEW_CLASS}
          onClick={() => displayMediaDialog(media)}
        />
      ) : media ? (
        <img
          src={media.url}
          alt={data.title}
          className={PREVIEW_CLASS}
          onClick={() => displayMediaDialog(media)}
        />
      ) : (
        <a
          href={data.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full p-4 text-center bg-muted/50 rounded-md hover:bg-muted transition-colors"
        >
          View on NASA's website →
        </a>
      )}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between w-full hover:bg-muted/50 rounded-md p-1 mt-2 transition-all ${!isExpanded ? "mb-[-5px]" : "mb-0"}`}
        title={isExpanded ? "Hide explanation" : "Show explanation"}
      >
        <h3 className="text-lg font-semibold">{data.title}</h3>
        <span className="text-muted-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-96" : "max-h-0"}`}
      >
        <p className="text-sm text-muted-foreground mt-1">{data.explanation}</p>
      </div>
    </div>
  );
}

export default {
  name: "NASA Daily Picture",
  fetchData,
  component: NasaApodWidget,
  staleTime: 1000 * 60 * 60 * 8,
  getExternalUrl: () => "https://science.nasa.gov/apod/",
} satisfies WidgetDefinition<Apod>;
