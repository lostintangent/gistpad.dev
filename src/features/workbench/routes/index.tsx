import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { queryClient } from "@/shared/query-client";
import { MOBILE_MEDIA_QUERY } from "@/shared/useMediaQuery";
import { githubToken } from "@/shared/github-token";
import { loadSession } from "@/features/account/queries";
import { gistQueries, getMostRecentGist } from "@/features/gists/queries";
import { openComments } from "@/features/comments/store";
import { mobilePanelAtom } from "../layout/state";
import { EDITOR_MODES, type EditorMode } from "../layout/preferences";
import { optionalString, omitReadmeFilePath } from "@/shared/routing";

interface EditorSearch {
  view?: EditorMode;
  heading?: string;
  quote?: string;
  replyTo?: number;
}

export const WorkbenchPage = lazyRouteComponent(() => import("../WorkbenchPage"));

// Overlap page loading with cache restoration and OAuth when the shell expects the workbench.
if (!import.meta.env.SSR && document.documentElement.dataset.startupPage === "workbench") {
  void WorkbenchPage.preload?.();
}

export const Route = createFileRoute("/_authenticated/{-$gistId}/{-$filePath}")({
  params: { stringify: omitReadmeFilePath },
  validateSearch: (search: Record<string, unknown>): EditorSearch => ({
    view: EDITOR_MODES.find((mode) => mode === search.view),
    heading: optionalString(search.heading),
    quote: optionalString(search.quote),
    replyTo: Number(search.replyTo) || undefined,
  }),
  beforeLoad: async ({ params, cause }) => {
    if (cause !== "enter" || params.gistId) return;
    if (githubToken.get()) queryClient.query(gistQueries.list()).catch(() => {});
    if (!(await loadSession())) return;
    const mostRecentGist = await getMostRecentGist();
    if (!mostRecentGist) return;
    if (window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      mobilePanelAtom.set("sidebar");
    }
    throw redirect({
      to: "/{-$gistId}/{-$filePath}",
      params: { gistId: mostRecentGist.id },
      replace: true,
    });
  },
  loaderDeps: ({ search: { quote, replyTo } }) => ({ quote, replyTo }),
  loader: async ({ params: { gistId }, deps: { quote, replyTo }, preload }) => {
    if (gistId) queryClient.query(gistQueries.detail(gistId)).catch(() => {});
    if (!preload && (quote || replyTo)) {
      openComments({ quote, replyTo });
      throw redirect({
        to: ".",
        search: ({ quote: _, replyTo: __, ...search }) => search,
        replace: true,
      });
    }
    // A matched child otherwise preloads even when its parent renders sign-in.
    if (await loadSession()) {
      queryClient.query(gistQueries.list()).catch(() => {});
      await WorkbenchPage.preload?.();
    }
  },
  // The wrapper keeps automatic component preloading behind the loader's session check.
  component: () => <WorkbenchPage />,
});
