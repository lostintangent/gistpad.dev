import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { deleteSpotifyPlaylistUrl, getSpotifyPlaylistUrl, setSpotifyPlaylistUrl } from "./utils"

interface SpotifyConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SpotifyConfigDialog({ open, onOpenChange }: SpotifyConfigDialogProps) {
  const [playlistUrl, setPlaylistUrl] = useState("")

  // Load saved URL when dialog opens
  useEffect(() => {
    if (open) {
      const savedUrl = getSpotifyPlaylistUrl()
      setPlaylistUrl(savedUrl)
    }
  }, [open])

  const handleSave = () => {
    if (playlistUrl.trim()) {
      // Save the URL
      setSpotifyPlaylistUrl(playlistUrl)
    } else {
      // Clear the URL
      deleteSpotifyPlaylistUrl()
    }

    // Notify SpotifyPlayer of the change
    window.dispatchEvent(new CustomEvent('spotify-playlist-updated'))

    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset to saved value
    const savedUrl = getSpotifyPlaylistUrl()
    setPlaylistUrl(savedUrl)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configure Spotify</DialogTitle>
          <DialogDescription>
            Enter a Spotify playlist URL to enable background music playback.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="playlist-url">Playlist URL</Label>
            <Input
              id="playlist-url"
              type="url"
              placeholder="https://open.spotify.com/playlist/..."
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Paste a Spotify playlist URL or share link
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}