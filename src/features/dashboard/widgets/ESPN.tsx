import { timeAgo } from "@/shared/dates";
import { Skeleton } from "@/shared/ui/skeleton";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { MediaDialog } from "../MediaDialog";
import type { WidgetDefinition, WidgetProps } from "../types";

interface ESPNNewsArticle {
  id: number;
  headline: string;
  published: string;
  links: { web: { href: string } };
  images?: { url: string; alt?: string; width: number }[];
  byline?: string;
}

// The API's path for each sport (whose league is also its section of espn.com)
const SPORT_PATHS: Record<string, string> = {
  NFL: "football/nfl",
  Baseball: "baseball/mlb",
  Basketball: "basketball/nba",
};

const getSportPath = (config: Record<string, string>) =>
  SPORT_PATHS[config.sport] ?? SPORT_PATHS.NFL;

async function fetchData(config: Record<string, string>): Promise<ESPNNewsArticle[]> {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(config)}/news`,
  );
  if (!response.ok) throw new Error("Failed to fetch ESPN news");

  const { articles } = await response.json();
  return articles.slice(0, Number(config.postCount) || 10);
}

function ESPNNewsWidget({ data, config }: WidgetProps<ESPNNewsArticle[]>) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  if (!data) {
    return (
      <div className="space-y-4">
        {[...Array(Number(config.postCount) || 10)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-24 h-16 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {data.map((article) => {
          const headerImage = article.images?.find(
            (img) => img.url && (img.width === 608 || img.width === 1296),
          );

          return (
            <div key={article.id} className="group not-last:border-b not-last:pb-4">
              <a
                href={article.links.web.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 hover:no-underline"
              >
                {headerImage ? (
                  <div
                    className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setImageUrl(headerImage.url);
                    }}
                  >
                    <img
                      src={headerImage.url}
                      alt={headerImage.alt || article.headline}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md bg-muted flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                    {article.headline}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{timeAgo(article.published)}</span>
                    {article.byline && (
                      <>
                        <span>•</span>
                        <span>{article.byline}</span>
                      </>
                    )}
                  </div>
                </div>
              </a>
            </div>
          );
        })}
      </div>
      {imageUrl && (
        <MediaDialog media={{ type: "image", url: imageUrl }} onClose={() => setImageUrl(null)} />
      )}
    </>
  );
}

export default {
  name: "ESPN News",
  fetchData,
  config: [
    { id: "sport", name: "Sport", options: ["NFL", "Baseball", "Basketball"] },
    { id: "postCount", name: "Post count", default: 10, minValue: 1, maxValue: 20 },
  ],
  component: ESPNNewsWidget,
  getExternalUrl: (config) => `https://www.espn.com/${getSportPath(config).split("/")[1]}/`,
} satisfies WidgetDefinition<ESPNNewsArticle[]>;
