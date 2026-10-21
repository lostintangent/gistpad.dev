import { createFileRoute, redirect } from "@tanstack/react-router";
import LoadingCard from "@/shared/cards/LoadingCard";
import { loadSession } from "@/features/account/queries";
import { ensureTodaysNote } from "../queries";
import { getTodayNoteFilename } from "@/shared/github";

export const Route = createFileRoute("/_authenticated/today")({
  preload: false,
  loader: async () => {
    if (!(await loadSession())) return;
    const gist = await ensureTodaysNote();
    throw redirect({
      to: "/{-$gistId}/{-$filePath}",
      params: { gistId: gist.id, filePath: getTodayNoteFilename() },
      replace: true,
    });
  },
  pendingMs: 0,
  pendingComponent: () => <LoadingCard message="Loading today's note..." />,
});
