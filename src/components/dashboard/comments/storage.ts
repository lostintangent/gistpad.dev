const COLLAPSED_STORAGE_KEY = "commentsDialog.collapsed";
const STALE_TIME = 48 * 60 * 60 * 1000;

interface CollapsedData {
  collapsedIds: string[];
  timestamp: number;
}

function getStorageKey(queryKey: any[]): string {
  return `${COLLAPSED_STORAGE_KEY}.${JSON.stringify(queryKey)}`;
}

function isDataExpired(timestamp: number): boolean {
  return Date.now() - timestamp >= STALE_TIME;
}

export function loadCollapsedIds(queryKey: any[]): string[] {
  try {
    const key = getStorageKey(queryKey);
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    const data: CollapsedData = JSON.parse(stored);
    if (isDataExpired(data.timestamp)) {
      localStorage.removeItem(key);
      return [];
    }

    return data.collapsedIds || [];
  } catch {
    return [];
  }
}

export function saveCollapsedIds(queryKey: any[], collapsedIds: string[]) {
  try {
    const key = getStorageKey(queryKey);
    const data: CollapsedData = {
      collapsedIds,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function gcOldCollapsedData() {
  try {
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(COLLAPSED_STORAGE_KEY)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data: CollapsedData = JSON.parse(stored);
            if (isDataExpired(data.timestamp)) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // Remove corrupted data
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // Ignore GC errors
  }
}
