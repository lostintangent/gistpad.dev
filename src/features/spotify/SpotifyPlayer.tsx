import { Button } from "@/shared/ui/button";
import { useIsMobile } from "@/shared/useMediaQuery";
import { Minimize2, Music, X } from "lucide-react";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { extractPlaylistId, playlistUrlAtom } from "./store";

/** Plays a Spotify playlist (which starts out minimized, whenever the playlist changes). */
function Player({ playlistId }: { playlistId: string }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const toggleMinimized = () => setIsMinimized(!isMinimized);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-[0.9rem] right-[0.6rem] z-50 bg-background border-l border-t rounded-tl-lg shadow-lg rounded-br-lg transition-all duration-200 ${
        isMinimized ? "w-12 h-12 overflow-hidden" : "w-80 h-53"
      }`}
    >
      {isMinimized && (
        <div
          className="flex items-center justify-center w-full h-full cursor-pointer hover:scale-105 transition-all duration-200 relative z-10"
          onClick={toggleMinimized}
        >
          <Music className="h-6 w-6 animate-pulse" />
        </div>
      )}

      <div
        className={`flex items-center justify-between p-2 border-b bg-muted/30 ${isMinimized ? "hidden" : ""}`}
      >
        <div className="flex items-center gap-2">
          <Music className="h-3 w-3" />
          <span className="text-xs font-medium truncate">Now Playing</span>
        </div>
        <div className="flex gap-1">
          <Button
            onClick={toggleMinimized}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted hover:text-red-500"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* (The player is hidden rather than unmounted when it's minimized, so that it keeps playing) */}
      <div className={`p-2 relative ${isMinimized ? "absolute -top-[9999px] -left-[9999px]" : ""}`}>
        {!isIframeLoaded && !isMinimized && (
          <div className="w-full h-[160px] bg-muted rounded animate-pulse flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Music className="h-8 w-8 text-muted-foreground animate-pulse" />
              <div className="text-xs text-muted-foreground">Loading playlist...</div>
            </div>
          </div>
        )}

        <iframe
          src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
          width="100%"
          height="160"
          style={{ border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className={`rounded transition-opacity duration-200 ${isIframeLoaded || isMinimized ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setIsIframeLoaded(true)}
        />
      </div>
    </div>
  );
}

export function SpotifyPlayer() {
  const playlistId = extractPlaylistId(useSelector(playlistUrlAtom));
  const isMobile = useIsMobile();

  // The player isn't displayed on mobile devices
  return playlistId && !isMobile ? <Player key={playlistId} playlistId={playlistId} /> : null;
}
