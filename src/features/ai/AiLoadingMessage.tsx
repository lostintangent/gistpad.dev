import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { Badge } from "@/shared/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { CircleChevronRight, Globe } from "lucide-react";
import { useEffect, useState } from "react";

const LOADING_MESSAGES = [
  "Consulting ancient scrolls",
  "Channeling literary wisdom",
  "Brewing profound insights",
  "Dancing with metaphors",
  "Weaving thoughtful narratives",
  "Distilling golden wisdom",
  "Pondering poetic possibilities",
  "Unlocking sage perspectives",
  "Discovering hidden meanings",
  "Crafting elegant responses",
  "Harmonizing diverse thoughts",
  "Painting with words",
  "Spinning silken sentences",
  "Gathering scholarly insights",
  "Exploring literary landscapes",
  "Orchestrating eloquent ideas",
  "Mining pearls of wisdom",
  "Wandering through wonder",
  "Cultivating clever thoughts",
  "Brightening dim passages",
];

/** Splits a reasoning summary into its (bolded) title, and its details. */
function parseReasoningSummary(summary: string | undefined) {
  const [titlePart = "", ...detailParts] = summary?.split(/\n\n/) ?? [];
  const title = titlePart.match(/\*\*(.+)\*\*/)?.[1];
  return title ? { title, details: detailParts.join("\n\n").trim() } : null;
}

const MESSAGE_INTERVAL = 4000;

/** An animated loading message, which displays the AI's reasoning (when it's available). */
export function AiLoadingMessage({
  reasoningSummary,
  showCompactDetails = false,
  isWebSearching = false,
}: {
  reasoningSummary?: string;
  /** Displays the reasoning details as an icon next to the message (as opposed to a badge below it). */
  showCompactDetails?: boolean;
  isWebSearching?: boolean;
}) {
  const reasoning = parseReasoningSummary(reasoningSummary);
  const hasReasoning = reasoning !== null;

  // Rotate through the loading messages (starting at a random one), until there's a reasoning summary.
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGES.length),
  );
  useEffect(() => {
    if (hasReasoning) return;

    const intervalId = setInterval(
      () => setMessageIndex((index) => (index + 1) % LOADING_MESSAGES.length),
      MESSAGE_INTERVAL,
    );
    return () => clearInterval(intervalId);
  }, [hasReasoning]);

  const details = reasoning?.details && (
    <Popover>
      <PopoverTrigger
        className={
          showCompactDetails ? "p-0.5 mt-0.5 text-muted-foreground hover:text-foreground" : ""
        }
        aria-label="View details"
      >
        {showCompactDetails ? (
          isWebSearching ? (
            <Globe className="w-4 h-4" />
          ) : (
            <CircleChevronRight className="w-4 h-4" />
          )
        ) : (
          <Badge className="text-xs bg-muted text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5">
            View details
            {isWebSearching && <Globe className="w-3 h-3" />}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="max-w-xs italic"
        initialFocus={false}
        side={showCompactDetails ? "top" : "bottom"}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MarkdownPreview isReadOnly>{reasoning.details}</MarkdownPreview>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Animated dots */}
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce opacity-60 [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce opacity-60 [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce opacity-60" />
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="ai-gradient-text text-lg font-medium flex-1">
          {reasoning?.title ?? LOADING_MESSAGES[messageIndex]}
        </span>
        {showCompactDetails && details}
      </div>
      {!showCompactDetails && details}
    </div>
  );
}
