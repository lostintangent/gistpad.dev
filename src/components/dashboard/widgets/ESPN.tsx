import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Trophy } from "lucide-react";
import { WidgetDefinition, WidgetProps } from "../types";

export interface ESPNNewsArticle {
  id: number;
  headline: string;
  description: string;
  published: string;
  links: {
    web: {
      href: string;
    };
  };
  images?: Array<{
    url: string;
    alt?: string;
    height: number;
    width: number;
  }>;
  byline?: string;
}

export interface ESPNNewsData {
  articles: ESPNNewsArticle[];
}

async function fetchData(config?: Record<string, string>): Promise<ESPNNewsData> {
  const sport = config?.sport || "NFL";
  const postCount = config?.postCount ? parseInt(config.postCount) : 10;
  const sportMap: Record<string, { path: string; site: string }> = {
    NFL: { path: "football/nfl", site: "nfl" },
    Baseball: { path: "baseball/mlb", site: "mlb" },
    Basketball: { path: "basketball/nba", site: "nba" },
  };
  const { path } = sportMap[sport] || sportMap["NFL"];

  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${path}/news`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch ESPN news");
  }

  const data = await response.json();

  // Get the configured number of articles
  const articles = data.articles.slice(0, postCount).map((article: any) => ({
    id: article.id,
    headline: article.headline,
    description: article.description,
    published: article.published,
    links: article.links,
    images: article.images,
    byline: article.byline,
  }));

  return { articles };
}

export function ESPNNewsWidget({
  data,
  isLoading,
  config,
  displayMediaDialog,
}: WidgetProps<ESPNNewsData>) {
  const sport = config?.sport || "NFL";
  const sportMap: Record<string, { site: string }> = {
    NFL: { site: "nfl" },
    Baseball: { site: "mlb" },
    Basketball: { site: "nba" },
  };
  const { site } = sportMap[sport] || sportMap["NFL"];
  if (isLoading) {
    const postCount = config?.postCount ? parseInt(config.postCount) : 10;
    return (
      <div className="space-y-4">
        {[...Array(postCount)].map((_, i) => (
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
    <div className="space-y-4">
      {data.articles.map((article, index) => {
        // Find the first header image
        const headerImage = article.images?.find(
          (img) => img.url && (img.width === 608 || img.width === 1296)
        );

        return (
          <div
            key={article.id}
            className={`group ${index !== data.articles.length - 1
              ? "border-b border-border pb-4"
              : ""
              }`}
          >
            <a
              href={article.links.web.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:no-underline"
            >
              <div className="flex gap-3">
                {/* Image */}
                {headerImage ? (
                  <div 
                    className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      displayMediaDialog(headerImage.url);
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

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                    {article.headline}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(article.published), {
                        addSuffix: true,
                      })}
                    </span>
                    {article.byline && (
                      <>
                        <span>•</span>
                        <span>{article.byline}</span>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </a>
          </div>
        );
      })}

    </div>
  );
}

export default {
  name: "ESPN News",
  fetchData,
  config: [
    { id: "sport", name: "Sport", options: ["NFL", "Baseball", "Basketball"] },
    { id: "postCount", name: "Post count", default: 10, minValue: 1, maxValue: 20 }
  ],
  component: ESPNNewsWidget,
  emptyStateMessage: "No sports news available",
  checkEmpty: (data) => !data || !data.articles || data.articles.length === 0,
  getExternalUrl: (config) => {
    const sport = config?.sport || "NFL";
    const sportMap: Record<string, string> = {
      NFL: "nfl",
      Baseball: "mlb",
      Basketball: "nba",
    };
    const site = sportMap[sport] || "nfl";
    return `https://www.espn.com/${site}/`;
  },
} as WidgetDefinition<ESPNNewsData>;
