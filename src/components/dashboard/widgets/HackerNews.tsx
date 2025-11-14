import { Skeleton } from "@/components/ui/skeleton";
import { decodeHtmlEntities } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, Clock, MessageSquare } from "lucide-react";
import { Comment } from "../comments";
import { WidgetDefinition, WidgetProps } from "../types";

export interface Story {
  id: number;
  title: string;
  by: string;
  score: number;
  url?: string;
  time: number;
  descendants?: number;
  text?: string;
  type?: string;
}

// Utility function to clean HackerNews HTML text
function cleanHackerNewsText(text?: string): string | undefined {
  if (!text) return;
  let decoded = decodeHtmlEntities(text);

  // The HN API truncates the URL of long links, and so this logic simply re-expands
  // them so that they always show the full URL.
  decoded = decoded.replace(
    /<a href="([^"]*)"[^>]*>([^<]+)<\/a>/g,
    (_, href) => `[${href}](${href})`
  );

  return decoded;
}

function getDomain(url?: string): string | undefined {
  if (!url) return;
  try {
    const { hostname, pathname } = new URL(url);
    const cleanHost = hostname.replace(/^www\./, "");
    const host = cleanHost.toLowerCase();
    const specialHosts = ["github.com", "twitter.com", "x.com"];
    if (specialHosts.includes(host)) {
      const firstSegment = pathname.split("/").filter(Boolean)[0];
      if (firstSegment) {
        return `${cleanHost}/${firstSegment}`;
      }
    }
    return cleanHost;
  } catch {
    return;
  }
}

export async function fetchData(
  config?: Record<string, string>
): Promise<Story[]> {
  // Get top story IDs
  const topStoriesResponse = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );
  const topStoryIds = await topStoriesResponse.json();

  // Use post count from config, default to 10
  const postCount = config?.postCount ? parseInt(config.postCount) : 10;

  // Fetch more stories than needed to account for filtered job posts
  const stories: Story[] = [];
  let index = 0;

  while (stories.length < postCount && index < topStoryIds.length) {
    const batchSize = Math.min(10, topStoryIds.length - index);
    const batchIds = topStoryIds.slice(index, index + batchSize);

    const storyPromises = batchIds.map(async (id: number) => {
      const response = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`
      );
      return response.json();
    });

    const batchStories = await Promise.all(storyPromises);

    // Filter out job posts
    const nonJobStories = batchStories.filter((story) => story.type !== "job");
    stories.push(...nonJobStories);

    index += batchSize;
  }

  // Return only the requested number of stories
  return stories.slice(0, postCount);
}

export async function fetchHackerNewsComments(
  storyId: number
): Promise<Comment[]> {
  const fetchComment = async (id: number): Promise<Comment | null> => {
    const response = await fetch(
      `https://hacker-news.firebaseio.com/v0/item/${id}.json`
    );
    const data = await response.json();
    if (!data || data.deleted || data.dead) return null;

    let replies: Comment[] = [];
    if (data.kids && data.kids.length > 0) {
      const repliesData = await Promise.all(
        data.kids.map((kid: number) => fetchComment(kid))
      );
      replies = repliesData.filter(Boolean) as Comment[];
    }

    return {
      id: data.id.toString(),
      user: {
        name: data.by,
        url: `https://news.ycombinator.com/user?id=${data.by}`,
      },
      date: new Date(data.time * 1000),
      text: cleanHackerNewsText(data.text),
      url: `https://news.ycombinator.com/item?id=${data.id}`,
      replies,
    };
  };

  const storyResponse = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
  );
  const story = await storyResponse.json();
  if (!story.kids || story.kids.length === 0) return [];

  const comments = await Promise.all(
    story.kids.map((id: number) => fetchComment(id))
  );
  return comments.filter(Boolean) as Comment[];
}

export function HackerNewsWidget({
  data,
  isLoading,
  config,
  openCommentsDialog,
}: WidgetProps<Story[]>) {
  if (isLoading) {
    const postCount = config?.postCount ? parseInt(config.postCount) : 10;
    return (
      <div className="space-y-3">
        {[...Array(postCount)].map((_, index) => (
          <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground mt-0.5">
                {index + 1}.
              </span>
              <div className="flex-1 space-y-3 mt-1">
                <Skeleton className="h-9 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((story, index) => (
        <div key={story.id} className="border-b pb-2 last:border-0 last:pb-0">
          <div className="flex gap-2">
            <span className="text-sm text-muted-foreground mt-0.5">
              {index + 1}.
            </span>
            <div className="flex-1">
              <a
                href={
                  story.url ||
                  `https://news.ycombinator.com/item?id=${story.id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline"
              >
                {story.title}
              </a>
              {story.url && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({getDomain(story.url)})
                </span>
              )}
              <div className="flex gap-3 text-xs text-muted-foreground mt-1 mb-2">
                {story.descendants !== undefined && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openCommentsDialog({
                        title: story.title,
                        text: cleanHackerNewsText(story.text),
                        queryKey: ["hn-comments", story.id],
                        fetchComments: () => fetchHackerNewsComments(story.id),
                      });
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors hover:underline"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {story.descendants}
                  </button>
                )}
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  {story.score}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(story.time * 1000), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default {
  name: "Hacker News",
  fetchData,
  config: [
    {
      id: "postCount",
      name: "Post count",
      default: 10,
      minValue: 1,
      maxValue: 20,
    },
  ],
  component: HackerNewsWidget,
  emptyStateMessage: null,
  getExternalUrl: () => "https://news.ycombinator.com",
} as WidgetDefinition<Story[]>;
