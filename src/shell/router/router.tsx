import { createHashHistory, createRouter, stringifySearchWith } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, restoreQueryCache } from "@/shared/query-client";
import { completeSignIn } from "@/features/account/queries";
import { resetComments } from "@/features/comments/store";
import { resetAgentForFile } from "@/features/agent/model/store";
import { revisionAtom } from "@/features/workbench/workspace/history/revision";
import { closeMobilePanels } from "@/features/workbench/layout/state";
import LoadingShell from "../LoadingShell";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    // GitHub Pages serves one document; all application paths remain in its hash.
    history: typeof window === "undefined" ? undefined : createHashHistory(),
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: LoadingShell,
    // Search params remain readable flat strings, including shared heading URLs.
    parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
    stringifySearch: stringifySearchWith(String),
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    hydrate: async () => {
      await restoreQueryCache();
      // Consume Supabase's OAuth hash before Start rematches application routes.
      const redirectPath = await completeSignIn();
      if (redirectPath !== undefined) router.history.replace(redirectPath);
    },
  });
  if (typeof window !== "undefined") {
    router.subscribe("onBeforeNavigate", ({ fromLocation, pathChanged }) => {
      if (!fromLocation || !pathChanged) return;
      resetComments();
      resetAgentForFile();
      revisionAtom.set(null);
      closeMobilePanels();
    });
  }
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
