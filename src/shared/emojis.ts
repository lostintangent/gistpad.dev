import { queryOptions } from "@tanstack/react-query";

export interface Emoji {
  id: string;
  name: string;
  keywords: string[];
  native: string;
}

/** The emoji dataset, which is large, and therefore loaded on demand (and never persisted). */
export const emojisQuery = queryOptions({
  queryKey: ["emojis"],
  queryFn: async (): Promise<Emoji[]> => {
    const { default: data } = await import("@emoji-mart/data/sets/15/native.json");
    return Object.entries(data.emojis).map(([id, emoji]) => ({
      id,
      name: emoji.name,
      keywords: emoji.keywords ?? [],
      native: emoji.skins[0]?.native ?? "",
    }));
  },
  staleTime: "static",
  gcTime: Infinity,
  meta: { persist: false },
});
