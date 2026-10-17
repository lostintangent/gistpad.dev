import { MOBILE_MEDIA_QUERY } from "@/shared/useMediaQuery";
import {
  createGist,
  EMPTY_CONTENT,
  getTodayNoteFilename,
  GitHubError,
  isArchived,
  isDailyNote,
} from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import ErrorCard from "@/shared/cards/ErrorCard";
import LoadingCard from "@/shared/cards/LoadingCard";
import SignInCard from "@/features/session/SignInCard";
import NotFoundCard from "@/shared/cards/NotFoundCard";
import { gistQueries, openDailyNote, setGistData } from "@/features/gists/queries";
import { sessionQuery, useSession } from "@/features/session/queries";
import { openComments } from "@/features/comments/store";
import { resetDocumentState } from "@/features/editor/store";
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  stringifySearchWith,
} from "@tanstack/react-router";

const root = createRootRoute({
  notFoundComponent: NotFoundCard,
  // GitHub rejects expired (or revoked) tokens, which requires the user to sign in again
  errorComponent: (props) =>
    props.error instanceof GitHubError && props.error.status === 401 ? (
      <SignInCard />
    ) : (
      <ErrorCard {...props} />
    ),
});

// Routes that require the user to be signed in
const authenticatedRoute = createRoute({
  getParentRoute: () => root,
  id: "authenticated",
  // (Using cached data when it's available, so that returning users don't wait)
  beforeLoad: async () => ({
    session: await queryClient.query({ ...sessionQuery, staleTime: "static" }),
  }),
  component: function Authenticated() {
    return useSession().session ? <Outlet /> : <SignInCard />;
  },
});

// Search params are parsed as flat strings (see `parseSearch` below), so they're validated by simple
// functions (which keeps a schema library out of the app's startup bundle).
const optionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

// A gist's README is its default file, so it's omitted from URLs (e.g. `/#/abc` vs. `/#/abc/notes.md`)
const omitReadmeFilePath = <T extends { filePath?: string }>({ filePath, ...params }: T) => ({
  ...params,
  filePath: filePath === "README.md" ? undefined : filePath,
});

const EDITOR_MODES = ["edit", "preview", "split"] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];

interface EditorSearch {
  view?: EditorMode;
  heading?: string;
  /** Text to quote in a new comment (e.g. when commenting from the share page). */
  quote?: string;
  /** A comment to reply to (e.g. when replying from the share page). */
  replyTo?: number;
}

const validateEditorSearch = (search: Record<string, unknown>): EditorSearch => ({
  view: EDITOR_MODES.find((mode) => mode === search.view),
  heading: optionalString(search.heading),
  quote: optionalString(search.quote),
  replyTo: Number(search.replyTo) || undefined,
});

export const editorRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/{-$gistId}/{-$filePath}",
  params: { stringify: omitReadmeFilePath },
  validateSearch: validateEditorSearch,
  // When the app is opened without a gist (on desktop), open the most recently updated one.
  beforeLoad: async ({ params, cause, context }) => {
    if (cause !== "enter" || params.gistId || window.matchMedia(MOBILE_MEDIA_QUERY).matches) return;
    if (!context.session) return;

    const gists = await queryClient.query({ ...gistQueries.list(), staleTime: "static" });
    const mostRecentGist = gists.find((gist) => !isDailyNote(gist) && !isArchived(gist));
    if (mostRecentGist) {
      throw redirect({
        to: "/{-$gistId}/{-$filePath}",
        params: { gistId: mostRecentGist.id },
        replace: true,
      });
    }
  },
  loaderDeps: ({ search: { quote, replyTo } }) => ({ quote, replyTo }),
  loader: ({ params: { gistId }, deps: { quote, replyTo }, preload }) => {
    // Start loading the gist on navigation (or when hovering a link to it), without blocking.
    if (gistId) queryClient.query(gistQueries.detail(gistId)).catch(() => {});

    // Links can ask to comment on (or reply to) the gist, e.g. from the share page.
    if (!preload && (quote || replyTo)) {
      openComments({ quote, commentId: replyTo, reply: !!replyTo });
      throw redirect({
        to: ".",
        search: ({ quote: _, replyTo: __, ...search }) => search,
        replace: true,
      });
    }
  },
  component: lazyRouteComponent(() => import("@/features/editor/EditorPage")),
});

/** Opens (or creates) today's daily note. */
const todayRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/today",
  loader: async ({ context }) => {
    if (!context.session) return;

    const gist = await openDailyNote();
    throw redirect({
      to: "/{-$gistId}/{-$filePath}",
      params: { gistId: gist.id, filePath: getTodayNoteFilename() },
      replace: true,
    });
  },
  pendingMs: 0,
  pendingComponent: () => <LoadingCard message="Loading today's note..." />,
});

/** Creates a new gist from the URL's search params (e.g. `/new?description=Ideas`). */
const newRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/new",
  validateSearch: (
    search: Record<string, unknown>,
  ): { description?: string; filename?: string; contents?: string; public?: string } => ({
    description: optionalString(search.description),
    filename: optionalString(search.filename),
    contents: optionalString(search.contents),
    public: optionalString(search.public),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    if (!context.session) return;

    const filename = deps.filename || "README.md";
    const gist = await createGist({
      description: deps.description,
      filename,
      content: deps.contents || EMPTY_CONTENT,
      isPublic: ["true", "1", "yes"].includes(deps.public?.toLowerCase() ?? ""),
    });

    setGistData(gist);
    throw redirect({
      to: "/{-$gistId}/{-$filePath}",
      params: { gistId: gist.id, filePath: filename },
      replace: true,
    });
  },
  pendingMs: 0,
  pendingComponent: () => <LoadingCard message="Creating gist..." />,
});

export const shareRoute = createRoute({
  getParentRoute: () => root,
  path: "/share/$gistId/{-$filePath}",
  params: { stringify: omitReadmeFilePath },
  validateSearch: (search: Record<string, unknown>): { heading?: string } => ({
    heading: optionalString(search.heading),
  }),
  component: lazyRouteComponent(() => import("@/features/share/SharePage")),
});

export const router = createRouter({
  routeTree: root.addChildren([
    authenticatedRoute.addChildren([editorRoute, todayRoute, newRoute]),
    shareRoute,
  ]),
  // Hash-based URLs, since the app is a static page (served by GitHub Pages)
  history: createHashHistory(),
  defaultPreload: "intent",
  // Query manages the freshness of loaded data
  defaultPreloadStaleTime: 0,
  // Search params are flat strings, so keep them readable (e.g. `?heading=2025`, not `?heading=%222025%22`)
  parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
  stringifySearch: stringifySearchWith(String),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Reset the transient state of the open document (e.g. its selected comment), whenever the
// user opens a different one (whether from a link, the back button, etc.). But not while the
// app is first loading, since its redirects can set that state (e.g. to reply to a comment).
router.subscribe("onBeforeNavigate", ({ fromLocation, pathChanged }) => {
  if (fromLocation && pathChanged) resetDocumentState();
});
