import { timeAgo } from "@/shared/dates";
import { Skeleton } from "@/shared/ui/skeleton";
import { ArrowUp, Clock, MessageSquare } from "lucide-react";
import { HANGING_LIST, HANGING_MARKER } from "../styles";
import type { Comment, WidgetDefinition, WidgetProps } from "../types";

interface Story {
  id: number;
  title: string;
  score: number;
  url?: string;
  time: number;
  descendants?: number;
  text?: string;
}

const fetchItem = async (id: number) =>
  (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();

// Decodes an item's (HTML) text, and re-expands its links (since the HN API truncates long URLs)
const cleanHackerNewsText = (text?: string) =>
  text
    ?.replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<a href="([^"]*)"[^>]*>([^<]+)<\/a>/g, (_, href) => `[${href}](${href})`);

/** A link's domain (along with the account, for GitHub and Twitter/X links). */
function getDomain(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const [account] = pathname.split("/").filter(Boolean);
    return ["github.com", "twitter.com", "x.com"].includes(host) && account
      ? `${host}/${account}`
      : host;
  } catch {
    return;
  }
}

async function fetchData(config: Record<string, string>): Promise<Story[]> {
  const response = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
  const ids: number[] = await response.json();
  const postCount = Number(config.postCount) || 10;

  // Stories are fetched in batches until there are enough of them (since job posts are skipped)
  const stories: Story[] = [];
  for (let index = 0; stories.length < postCount && index < ids.length; index += 10) {
    const batch = await Promise.all(ids.slice(index, index + 10).map(fetchItem));
    stories.push(...batch.filter((story) => story.type !== "job"));
  }

  return stories.slice(0, postCount);
}

/** Fetches the replies to an item (and their replies), skipping the deleted and dead ones. */
async function fetchReplies(ids: number[] = []): Promise<Comment[]> {
  const replies = await Promise.all(
    ids.map(async (id): Promise<Comment | null> => {
      const item = await fetchItem(id);
      if (!item || item.deleted || item.dead) return null;

      return {
        id: String(item.id),
        user: { name: item.by, url: `https://news.ycombinator.com/user?id=${item.by}` },
        date: new Date(item.time * 1000),
        text: cleanHackerNewsText(item.text),
        url: `https://news.ycombinator.com/item?id=${item.id}`,
        replies: await fetchReplies(item.kids),
      };
    }),
  );

  return replies.filter((reply) => reply !== null);
}

function HackerNewsWidget({ data, config, openCommentsDialog }: WidgetProps<Story[]>) {
  if (!data) {
    return (
      <div className={`space-y-3 ${HANGING_LIST}`}>
        {[...Array(Number(config.postCount) || 10)].map((_, index) => (
          <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
            <div className="flex">
              <span className={`${HANGING_MARKER} text-sm text-muted-foreground mt-0.5`}>
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
    <div className={`space-y-3 ${HANGING_LIST}`}>
      {data.map((story, index) => (
        <div key={story.id} className="border-b pb-2 last:border-0 last:pb-0">
          <div className="flex">
            <span className={`${HANGING_MARKER} text-sm text-muted-foreground mt-0.5`}>
              {index + 1}.
            </span>
            <div className="flex-1">
              <a
                href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline"
              >
                {story.title}
              </a>
              {story.url && (
                <span className="text-xs text-muted-foreground ml-1">({getDomain(story.url)})</span>
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
                        // (The story is refetched, so that refreshing the dialog shows new comments)
                        fetchComments: async () => fetchReplies((await fetchItem(story.id)).kids),
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
                  {timeAgo(story.time * 1000)}
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
  config: [{ id: "postCount", name: "Post count", default: 10, minValue: 1, maxValue: 20 }],
  component: HackerNewsWidget,
  emptyStateMessage: null,
  getExternalUrl: () => "https://news.ycombinator.com",
} satisfies WidgetDefinition<Story[]>;
