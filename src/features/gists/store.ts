import { createAtom } from "@tanstack/react-store";

/** The gist list's selected tag filters. */
export const tagFiltersAtom = createAtom<string[]>([]);
