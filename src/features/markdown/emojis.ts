import { emojisQuery, type Emoji } from "@/shared/emojis";
import { useQuery } from "@tanstack/react-query";

const toEmojiMap = (emojis: Emoji[]) => new Map(emojis.map((emoji) => [emoji.id, emoji.native]));

/** Emojis by their shortcode (e.g. `tada`), once the emoji data has loaded. */
export function useEmojiMap(isEnabled: boolean) {
  const { data } = useQuery({ ...emojisQuery, enabled: isEnabled, select: toEmojiMap });
  return data;
}
