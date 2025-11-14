export const SPOTIFY_STORAGE_KEY = "gistpad-spotify-playlist-url"

export function extractPlaylistId(url: string): string | null {
  // Match various Spotify playlist URL formats
  const patterns = [
    /spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
    /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
    /spotify:playlist:([a-zA-Z0-9]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

// Spotify playlist URL storage utilities
export function getSpotifyPlaylistUrl(): string {
  return localStorage.getItem(SPOTIFY_STORAGE_KEY) || ""
}

export function setSpotifyPlaylistUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(SPOTIFY_STORAGE_KEY, url.trim())
  } else {
    localStorage.removeItem(SPOTIFY_STORAGE_KEY)
  }
}

export function deleteSpotifyPlaylistUrl(): void {
  localStorage.removeItem(SPOTIFY_STORAGE_KEY)
}

// Combined utility to get playlist ID from storage
export function getStoredPlaylistId(): string | null {
  const url = getSpotifyPlaylistUrl()
  return url ? extractPlaylistId(url) : null
}