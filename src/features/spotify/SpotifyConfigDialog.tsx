import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useState } from "react";
import { playlistUrlAtom } from "./store";

function PlaylistForm({ onClose }: { onClose: () => void }) {
  const [playlistUrl, setPlaylistUrl] = useState(() => playlistUrlAtom.get());

  const handleSave = () => {
    playlistUrlAtom.set(playlistUrl.trim());
    onClose();
  };

  return (
    <>
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
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </>
  );
}

export function SpotifyConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configure Spotify</DialogTitle>
          <DialogDescription>
            Enter a Spotify playlist URL to enable background music playback.
          </DialogDescription>
        </DialogHeader>
        <PlaylistForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
