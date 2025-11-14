import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/useMobile"
import { Minimize2, Music, X } from "lucide-react"
import { useEffect, useState } from "react"
import { getStoredPlaylistId } from "./utils"

interface SpotifyPlayerState {
  playlistId: string | null
  isVisible: boolean
  isMinimized: boolean
}

export function SpotifyPlayer() {
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>({
    playlistId: null,
    isVisible: false,
    isMinimized: false
  })
  const [isIframeLoaded, setIsIframeLoaded] = useState(false)
  const isMobile = useIsMobile()

  // Check for existing playlist on mount and show player automatically
  useEffect(() => {
    const playlistId = getStoredPlaylistId()
    if (playlistId) {
      setPlayerState({
        playlistId,
        isVisible: true, // Automatically show player if playlist exists
        isMinimized: true // Start minimized
      })
    }
  }, [])

  // Reset loading state when playlist changes
  useEffect(() => {
    setIsIframeLoaded(false)
  }, [playerState.playlistId])

  // Listen for playlist changes from storage (when config dialog saves)
  useEffect(() => {
    const handleStorageChange = () => {
      const playlistId = getStoredPlaylistId()
      setPlayerState(prev => ({
        ...prev,
        playlistId,
        isVisible: !!playlistId
      }))
    }

    // Listen for custom events from config dialog
    window.addEventListener('spotify-playlist-updated', handleStorageChange)

    return () => {
      window.removeEventListener('spotify-playlist-updated', handleStorageChange)
    }
  }, [])

  const hidePlayer = () => {
    setPlayerState(prev => ({ ...prev, isVisible: false }))
  }

  const toggleMinimized = () => {
    setPlayerState(prev => ({ ...prev, isMinimized: !prev.isMinimized }))
  }

  // Don't render on mobile devices
  if (isMobile || !playerState.isVisible || !playerState.playlistId) {
    return null
  }

  return (
    <div className={`fixed bottom-[0.9rem] right-[0.6rem] z-50 bg-background border-l border-t rounded-tl-lg shadow-lg rounded-br-lg transition-all duration-200 ${playerState.isMinimized ? 'w-12 h-12 overflow-hidden' : 'w-80 h-53'
      }`}>
      {/* Minimized State - Clickable Music Icon */}
      {playerState.isMinimized && (
        <div
          className="flex items-center justify-center w-full h-full cursor-pointer hover:scale-105 transition-all duration-200 relative z-10"
          onClick={toggleMinimized}
        >
          <Music className="h-6 w-6 animate-pulse" />
        </div>
      )}

      {/* Header - Always rendered */}
      <div className={`flex items-center justify-between p-2 border-b bg-muted/30 ${playerState.isMinimized ? 'hidden' : ''}`}>
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
            onClick={hidePlayer}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted hover:text-red-500"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Player Content - Always rendered, just hidden when minimized */}
      <div className={`p-2 relative ${playerState.isMinimized ? 'absolute -top-[9999px] -left-[9999px]' : ''}`}>
        {/* Loading skeleton */}
        {!isIframeLoaded && !playerState.isMinimized && (
          <div className="w-full h-[160px] bg-muted rounded animate-pulse flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Music className="h-8 w-8 text-muted-foreground animate-pulse" />
              <div className="text-xs text-muted-foreground">Loading playlist...</div>
            </div>
          </div>
        )}

        <iframe
          src={`https://open.spotify.com/embed/playlist/${playerState.playlistId}?utm_source=generator&theme=0`}
          width="100%"
          height="160"
          style={{ border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className={`rounded transition-opacity duration-200 ${isIframeLoaded || playerState.isMinimized ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsIframeLoaded(true)}
        />
      </div>
    </div>
  )
}