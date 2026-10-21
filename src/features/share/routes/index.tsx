import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { queryClient } from "@/shared/query-client";
import { gistQueries } from "@/features/gists/queries";
import { optionalString, omitReadmeFilePath } from "@/shared/routing";

export const SharePage = lazyRouteComponent(() => import("../SharePage"));

export const Route = createFileRoute("/share/$gistId/{-$filePath}")({
  params: { stringify: omitReadmeFilePath },
  validateSearch: (search: Record<string, unknown>): { heading?: string } => ({
    heading: optionalString(search.heading),
  }),
  loader: ({ params: { gistId } }) => {
    queryClient.query(gistQueries.detail(gistId)).catch(() => {});
  },
  component: SharePage,
});
