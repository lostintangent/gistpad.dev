import { persistedAtom, RAW_STRING } from "@/shared/persistedAtom";

/** The URL of the Spotify playlist that plays in the background (if the user has configured one). */
export const playlistUrlAtom = persistedAtom("gistpad-spotify-playlist-url", "", RAW_STRING);

export function extractPlaylistId(url: string): string | null {
  // Matches playlist URLs (e.g. https://open.spotify.com/playlist/:id) and URIs (spotify:playlist:id)
  return url.match(/spotify(?:\.com\/|:)playlist[/:]([a-zA-Z0-9]+)/)?.[1] ?? null;
}
