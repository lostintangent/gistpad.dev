import TagBadge from "@/components/list/TagBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { decodeHtmlEntities } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { getLinkPreview } from "link-preview-js";
import { Image, MessageSquare, TrendingUp, TriangleAlert } from "lucide-react";
import {
  Comment,
  MediaItem,
  WidgetBadge,
  WidgetDefinition,
  WidgetProps,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  permalink: string;
  url: string;
  selftext?: string;
  thumbnail?: string;
  spoiler?: boolean;
  post_hint?: string;
  flair?: string;
  flairColor?: string;
  video?: string;
  embed?: string;
  gallery?: string[];
}

export interface RedditData {
  posts: RedditPost[];
}

// Note: Periodically, the Reddit API will omit CORS headers, and
// so I'm proxying the request through a CORS proxy in order to prevent
// that. I could go directly to the Reddit API and only fallback to the
// proxy on failure, but I haven't noticed any latency impact with the
// proxy, so I'm choosing to keep the implementation simple.
async function fetchData(config?: Record<string, string>): Promise<RedditData> {
  const subreddit = config?.subreddit;
  const postCount = config?.postCount ? parseInt(config.postCount) : 5;
  const sortBy = config?.sortBy ? config.sortBy.toLowerCase() : "new";

  const endpoint = `https://www.reddit.com/r/${subreddit}/${sortBy}.json?limit=${postCount}`;
  const response = await fetch(
    // `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`
    endpoint
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Reddit posts");
  }

  const data = await response.json();
  const posts = await Promise.all(
    data.data.children.map(async (child: any) => {
      // If this is a cross-post, use the original post's data for media
      const source = child.data.crosspost_parent_list?.[0] || child.data;

      // Get the best quality image available
      let imageUrl = null;
      let videoUrl = null;
      let embedUrl = null;
      let galleryImages: string[] = [];

      // Check for videos
      if (
        source.is_video ||
        source.media?.reddit_video ||
        source.secure_media?.reddit_video ||
        source.preview?.reddit_video_preview
      ) {
        const vid =
          source.media?.reddit_video?.fallback_url ||
          source.secure_media?.reddit_video?.fallback_url ||
          source.preview?.reddit_video_preview?.fallback_url;
        if (vid) {
          videoUrl = decodeHtmlEntities(vid);
        }
      } else if (
        source.secure_media?.oembed?.html ||
        source.media?.oembed?.html
      ) {
        // External videos (e.g. YouTube, Vimeo)
        const oembed = source.secure_media?.oembed || source.media?.oembed;
        const html = oembed.html as string;
        const match = html.match(/src="([^"]+)"/);
        if (match) {
          embedUrl = match[1];
        }
        if (!imageUrl && oembed.thumbnail_url) {
          imageUrl = decodeHtmlEntities(oembed.thumbnail_url);
        }
      }

      // Handle galleries
      if (source.gallery_data?.items && source.media_metadata) {
        galleryImages = source.gallery_data.items
          .map((item: any) => {
            const media = source.media_metadata[item.media_id];
            const url =
              media?.s?.u ||
              (media?.p?.length ? media.p[media.p.length - 1].u : null);
            return url ? decodeHtmlEntities(url) : null;
          })
          .filter((url: string | null) => url !== null) as string[];

        if (galleryImages.length > 0) {
          imageUrl = galleryImages[0];
        }
      } else if (source.preview?.images?.[0]?.source?.url) {
        // Check for preview images first (higher quality)
        imageUrl = decodeHtmlEntities(source.preview.images[0].source.url);
      } else if (
        source.thumbnail &&
        source.thumbnail !== "self" &&
        source.thumbnail !== "default" &&
        source.thumbnail !== "nsfw" &&
        source.thumbnail !== "spoiler" &&
        source.thumbnail.startsWith("http")
      ) {
        imageUrl = source.thumbnail;
      } else if (source.url && !source.url.includes("reddit.com")) {
        try {
          const preview = await getLinkPreview(source.url);
          if (Array.isArray(preview.images) && preview.images.length > 0) {
            imageUrl = preview.images[0];
          }
        } catch {
          // Ignore preview errors
        }
      }

      return {
        id: child.data.id,
        title: decodeHtmlEntities(child.data.title),
        author: child.data.author,
        created_utc: child.data.created_utc,
        score: child.data.score,
        num_comments: child.data.num_comments,
        permalink: child.data.permalink,
        url: child.data.url,
        selftext: source.selftext || child.data.selftext,
        thumbnail: imageUrl,
        spoiler: child.data.spoiler,
        post_hint: child.data.post_hint,
        flair: child.data.link_flair_text,
        flairColor: child.data.link_flair_background_color,
        video: videoUrl,
        embed: embedUrl,
        gallery: galleryImages.length > 0 ? galleryImages : undefined,
      };
    })
  );

  return { posts };
}

async function fetchBadge(
  config?: Record<string, string>
): Promise<WidgetBadge | undefined> {
  const subreddit = config?.subreddit;
  if (!subreddit) {
    return;
  }

  const endpoint = `https://www.reddit.com/r/${subreddit}/about.json`;
  const response = await fetch(
    //`https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`
    endpoint
  );

  if (!response.ok) {
    throw new Error("Failed to fetch subreddit info");
  }

  const data = await response.json();
  const activeUsers =
    data.data?.active_user_count ?? data.data?.accounts_active ?? 0;

  return { count: activeUsers, color: "#22c55e" };
}

async function fetchRedditComments(permalink: string, sort: string = "top"): Promise<Comment[]> {
  const endpoint = `https://www.reddit.com${permalink}.json?sort=${sort.toLowerCase()}`;
  const response = await fetch(
    // `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`
    endpoint
  );
  const data = await response.json();
  const comments = data[1].data.children
    .filter((child: any) => child.kind === "t1")
    .map((child: any) => mapComment(child.data, permalink));
  return comments;
}

function mapComment(
  data: any,
  parentPermalink?: string,
  depth: number = 0
): Comment {
  const replies = data.replies?.data?.children
    ? data.replies.data.children
      .filter((c: any) => c.kind === "t1")
      .map((c: any) => mapComment(c.data, data.permalink, depth + 1))
    : [];

  // Build the comment URL
  const commentUrl = data.permalink
    ? `https://reddit.com${data.permalink}`
    : parentPermalink
      ? `https://reddit.com${parentPermalink}${data.id}`
      : undefined;

  // Process comment body using the shared function
  const processedText = processRedditImages(data.body || "", {
    useHtmlImages: true,
    depth,
    mediaMetadata: data.media_metadata
  });

  // Extract user avatar
  let avatarUrl: string | undefined;

  // Check for author flair image (custom emoji/avatar)
  if (data.author_flair_richtext && data.author_flair_richtext.length > 0) {
    const flairWithImage = data.author_flair_richtext.find(
      (flair: any) => flair.u
    );
    if (flairWithImage?.u) {
      avatarUrl = flairWithImage.u;
    }
  }

  // If no flair image, check for snoovatar (Reddit's avatar system)
  if (!avatarUrl && data.author_icon_img) {
    avatarUrl = decodeHtmlEntities(data.author_icon_img);
  }

  return {
    id: data.id,
    user: {
      name: data.author,
      url: `https://reddit.com/u/${data.author}`,
      avatar: avatarUrl,
    },
    date: new Date(data.created_utc * 1000),
    text: decodeHtmlEntities(processedText),
    url: commentUrl,
    points: data.score,
    replies,
  };
}

function processRedditImages(
  text: string,
  options?: {
    useHtmlImages?: boolean;
    depth?: number;
    mediaMetadata?: any;
  }
): string {
  let processedText = text;
  const { useHtmlImages = false, depth = 0, mediaMetadata } = options || {};

  // Check if there are Giphy references in the comment (only for comments)
  if (mediaMetadata) {
    processedText = processedText.replace(
      /!\[gif\]\((giphy\|[^)]+)\)/g,
      (match: string, giphyId: string) => {
        const media = mediaMetadata[giphyId];
        if (media?.s?.gif) {
          return `![gif](${media.s.gif})`;
        }
        return match;
      }
    );
  }

  // Detect i.redd.it image URLs (including GIFs) and convert to markdown images
  processedText = processedText.replace(
    /https:\/\/i\.redd\.it\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/gi,
    (match: string) => {
      const cleanUrl = decodeHtmlEntities(match);
      const isGif = match.toLowerCase().endsWith('.gif');
      return isGif ? `![gif](${cleanUrl})` : `![image](${cleanUrl})`;
    }
  );

  // Detect and convert preview.redd.it URLs
  processedText = processedText.replace(
    /https:\/\/preview\.redd\.it\/[^\s)]+/g,
    (match: string) => {
      const cleanUrl = decodeHtmlEntities(match);
      if (useHtmlImages) {
        // For comments: use HTML with indentation-aware max-width
        const indentPx = depth * 12 + 12;
        return `<img src="${cleanUrl}" style="max-width: calc(min(90vw, 400px) - ${indentPx}px)">`;
      } else {
        // For descriptions: use markdown
        return `![image](${cleanUrl})`;
      }
    }
  );

  // Detect imgur URLs and convert to markdown images
  processedText = processedText.replace(
    /https:\/\/(i\.)?imgur\.com\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/gi,
    (match: string) => {
      const cleanUrl = decodeHtmlEntities(match);
      return `![image](${cleanUrl})`;
    }
  );

  return processedText;
}

const PlayButton = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <svg
        className="w-5 h-5 md:w-6 md:h-6 text-white ml-0.5"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  </div>
);

const GalleryCounter = ({ current, total }: { current: number; total: number }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <span className="text-white text-sm md:text-base font-medium">
        {current} / {total}
      </span>
    </div>
  </div>
);

export function RedditWidget({
  data,
  isLoading,
  config,
  openCommentsDialog,
  displayMediaDialog,
}: WidgetProps<RedditData>) {

  if (isLoading) {
    const postCount = config?.postCount ? parseInt(config.postCount) : 5;
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
      {data.posts.map((post, index) => (
        <div
          key={post.id}
          className={`group ${index !== data.posts.length - 1 ? "border-b border-border pb-4" : ""
            }`}
        >
          <a
            href={`https://reddit.com${post.permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:no-underline"
          >
            <div className="flex gap-3">
              {/* Media */}
              {post.spoiler ? (
                <div className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md bg-muted flex items-center justify-center">
                  <TriangleAlert className="w-8 h-8 text-muted-foreground/50" />
                </div>
              ) : post.video ? (
                <div
                  className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer relative"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Reddit's APIs provide videos that don't include an audio track,
                    // and therefore we need to get the URL of the audio track and then
                    // pass it to the media dialog. And to make matters worse, the API
                    // doesn't even provide a way to get the audio track URL directly.
                    // So we need to use some magic logic to hardcode it.
                    const videoIdMatch = post.video.match(/v\.redd\.it\/([^/]+)/);
                    const audioUrl = videoIdMatch
                      ? `https://v.redd.it/${videoIdMatch[1]}/DASH_AUDIO_128.mp4`
                      : undefined;
                    const media: MediaItem = {
                      type: "video",
                      url: post.video,
                      posterUrl: post.thumbnail || "",
                      audioUrl,
                    };
                    displayMediaDialog(media);
                  }}
                >
                  <video
                    src={post.video}
                    poster={post.thumbnail}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    muted
                    loop
                    playsInline
                  />
                  <PlayButton />
                </div>
              ) : post.embed ? (
                <div
                  className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer relative"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const media: MediaItem = {
                      type: "embed",
                      src: post.embed,
                    };
                    displayMediaDialog(media);
                  }}
                >
                  <img
                    src={post.thumbnail}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <PlayButton />
                </div>
              ) : post.thumbnail ? (
                <div
                  className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer relative"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const media: MediaItem[] = post.gallery
                      ? post.gallery.map((url) => ({
                        type: "image" as const,
                        url,
                      }))
                      : [{ type: "image" as const, url: post.thumbnail }];
                    displayMediaDialog(media.length === 1 ? media[0] : media);
                  }}
                >
                  <img
                    src={post.thumbnail}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {post.gallery && post.gallery.length > 1 && (
                    <GalleryCounter current={1} total={post.gallery.length} />
                  )}
                </div>
              ) : (
                <div className="w-24 h-16 md:w-32 md:h-20 flex-shrink-0 rounded-md bg-muted flex items-center justify-center">
                  <Image className="w-8 h-8 text-muted-foreground/50" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                {/* Title */}
                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                {post.flair &&
                  (post.flairColor ? (
                    <TagBadge tag={post.flair} color={post.flairColor} />
                  ) : (
                    <Badge variant="secondary" className="max-w-full">
                      <span className="block min-w-0 truncate">{post.flair}</span>
                    </Badge>
                  ))}

                {/* Time */}
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_utc * 1000), {
                    addSuffix: true,
                  })}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const commentSort = config?.commentSort ? config.commentSort.toLowerCase() : "top";
                      openCommentsDialog({
                        title: post.title,
                        text: post.selftext ? processRedditImages(post.selftext) : undefined,
                        queryKey: ["reddit-comments", post.id, commentSort],
                        fetchComments: () =>
                          fetchRedditComments(post.permalink, commentSort),
                      });
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {post.num_comments}
                  </button>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {post.score}
                  </span>
                </div>
              </div>

            </div>
          </a>
        </div>
      ))}
    </div>
  );
}

export default {
  name: "Reddit",
  fetchData,
  config: [
    { id: "subreddit", name: "Sub-Reddit" },
    {
      id: "sortBy",
      name: "Post sort",
      options: ["New", "Hot", "Top"],
      default: "New",
    },
    {
      id: "commentSort",
      name: "Comment sort",
      options: ["Best", "Top", "New"],
      default: "Top",
    },
    {
      id: "postCount",
      name: "Post count",
      default: 5,
      minValue: 1,
      maxValue: 20,
    },
  ],
  component: RedditWidget,
  emptyStateMessage: "No posts available",
  checkEmpty: (data) => !data || !data.posts || data.posts.length === 0,
  getExternalUrl: (config) =>
    `https://reddit.com/r/${config?.subreddit || "all"}`,
  //getBadge: fetchBadge, Reddit seemed to disable active user counts?
} as WidgetDefinition<RedditData>;
