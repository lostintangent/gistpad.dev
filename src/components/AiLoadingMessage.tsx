import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CircleChevronRight, Globe } from "lucide-react";
import { useEffect, useState } from "react";

export const LOADING_MESSAGES = [
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

interface AiLoadingMessageProps {
  messages?: string[];
  interval?: number;
  className?: string;
  reasoningSummary?: string;
  showCompactDetails?: boolean;
  isWebSearching?: boolean;
}

export function AiLoadingMessage({
  messages = LOADING_MESSAGES,
  interval = 4000,
  className = "",
  reasoningSummary,
  showCompactDetails = false,
  isWebSearching = false,
}: AiLoadingMessageProps) {
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(
    messages[Math.floor(Math.random() * messages.length)]
  );

  useEffect(() => {
    if (!reasoningSummary) return;

    const [titlePart, ...detailParts] = reasoningSummary.split(/\n\n/);
    const match = titlePart.match(/\*\*(.+)\*\*/);
    if (!match) return;

    const title = match ? match[1] : titlePart;
    const details = detailParts.join("\n\n").trim();
    setCurrentLoadingMessage(title);
    setLoadingDetails(details);
  }, [reasoningSummary]);

  useEffect(() => {
    // Stop the interval once we have a reasoning summary
    if (reasoningSummary) return;

    const intervalId = setInterval(() => {
      setCurrentLoadingMessage((prevMessage) => {
        const currentIndex = messages.indexOf(prevMessage);
        const nextIndex = (currentIndex + 1) % messages.length;
        return messages[nextIndex];
      });
    }, interval);

    return () => clearInterval(intervalId);
  }, [messages, interval, reasoningSummary]);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Animated dots */}
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce opacity-60 [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce opacity-60 [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce opacity-60" />
      </div>
      {/* Loading message */}
      <div className="flex items-center justify-center gap-2">
        <span className="bg-linear-to-r from-green-400 to-purple-600 bg-clip-text text-transparent animate-gradient-pulse text-lg font-medium flex-1">
          {currentLoadingMessage}
        </span>
        {loadingDetails && showCompactDetails && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-xs p-0.5 mt-0.5 text-muted-foreground hover:text-foreground">
                {isWebSearching ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <CircleChevronRight className="w-4 h-4" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="max-w-xs italic"
              autoFocus={false}
              side="top"
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownPreview isReadonly={true}>
                  {loadingDetails}
                </MarkdownPreview>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {loadingDetails && !showCompactDetails && (
        <Popover>
          <PopoverTrigger asChild>
            <button>
              <Badge className="text-xs bg-muted text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5">
                View details
                {isWebSearching && <Globe className="w-3 h-3" />}
              </Badge>

            </button>
          </PopoverTrigger>
          <PopoverContent
            className="max-w-xs italic"
            autoFocus={false}
            side="bottom"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownPreview isReadonly={true}>
                {loadingDetails}
              </MarkdownPreview>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
