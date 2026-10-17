const STORAGE_KEY_PREFIX = "commentsDialog.collapsed";
const MAX_AGE = 48 * 60 * 60 * 1000;

const getStorageKey = (queryKey: unknown[]) => `${STORAGE_KEY_PREFIX}.${JSON.stringify(queryKey)}`;

/** Loads the comments that the user collapsed (after forgetting any that were collapsed too long ago). */
export function loadCollapsedIds(queryKey: unknown[]): string[] {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(STORAGE_KEY_PREFIX)) continue;

    try {
      const { timestamp } = JSON.parse(localStorage.getItem(key)!);
      if (Date.now() - timestamp >= MAX_AGE) localStorage.removeItem(key);
    } catch {
      // Remove corrupted data
      localStorage.removeItem(key);
    }
  }

  return JSON.parse(localStorage.getItem(getStorageKey(queryKey)) ?? "{}").collapsedIds ?? [];
}

export function saveCollapsedIds(queryKey: unknown[], collapsedIds: string[]) {
  try {
    localStorage.setItem(
      getStorageKey(queryKey),
      JSON.stringify({ collapsedIds, timestamp: Date.now() }),
    );
  } catch {
    // Ignore storage errors (e.g. when it's full)
  }
}
