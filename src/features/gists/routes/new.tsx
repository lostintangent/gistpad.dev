import { createFileRoute, redirect } from "@tanstack/react-router";
import LoadingCard from "@/shared/cards/LoadingCard";
import { optionalString } from "@/shared/routing";
import { loadSession } from "@/features/account/queries";
import { createGist, EMPTY_CONTENT } from "@/shared/github";
import { setGistData } from "../queries";

export const Route = createFileRoute("/_authenticated/new")({
  preload: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    description?: string;
    filename?: string;
    contents?: string;
    public?: string;
  } => ({
    description: optionalString(search.description),
    filename: optionalString(search.filename),
    contents: optionalString(search.contents),
    public: optionalString(search.public),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!(await loadSession())) return;
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
