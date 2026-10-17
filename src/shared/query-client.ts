import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery, MutationCache, QueryClient } from "@tanstack/react-query";
import { persistQueryClient, removeOldestQuery } from "@tanstack/react-query-persist-client";
import { toast } from "sonner";
import { GitHubError } from "./github";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** Excludes a query from the localStorage cache (e.g. for large, static data). */
      persist?: false;
    };
    mutationMeta: {
      /** Shown in a loading toast while the mutation is running. */
      pendingMessage?: string;
      /** Shown in an error toast if the mutation fails. */
      errorMessage?: string;
    };
  }
}

const CACHE_LIFETIME = 1000 * 60 * 60 * 24 * 5; // 5 days

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_LIFETIME,
      // Client errors (e.g. a deleted gist, or an expired token) won't succeed on a retry
      retry: (failureCount, error) =>
        failureCount < 3 && !(error instanceof GitHubError && error.status < 500),
    },
  },
  mutationCache: new MutationCache({
    onMutate: (_variables, mutation) => {
      const { pendingMessage } = mutation.meta ?? {};
      if (pendingMessage) toast.loading(pendingMessage, { id: mutation.mutationId });
    },
    onError: (_error, _variables, _result, mutation) => {
      const { errorMessage } = mutation.meta ?? {};
      if (errorMessage) toast.error(errorMessage);
    },
    onSettled: (_data, _error, _variables, _result, mutation) => {
      if (mutation.meta?.pendingMessage) toast.dismiss(mutation.mutationId);
    },
  }),
});

/**
 * Restores the queries that were cached in localStorage (so that returning users see their
 * gists immediately, while they're revalidated in the background), and keeps caching them.
 */
export function restoreQueryCache() {
  const [, restored] = persistQueryClient({
    queryClient,
    persister: createAsyncStoragePersister({
      storage: window.localStorage,
      key: "gistpad-data-cache",
      // When localStorage is full, make room by evicting the least recently updated queries
      retry: removeOldestQuery,
    }),
    maxAge: CACHE_LIFETIME,
    // Bump this whenever the shape of cached data changes
    buster: "2",
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) && query.meta?.persist !== false,
    },
  });

  return restored;
}
