import type { GistRevision } from "@/shared/github";
import { formatDistanceToNow } from "date-fns";

export function RevisionLabel({
  revision,
  gistCreatedAt,
  showChangeStats = true,
}: {
  revision: GistRevision;
  gistCreatedAt?: string;
  showChangeStats?: boolean;
}) {
  const { additions, deletions } = revision.change_status;
  const isCreation =
    !!gistCreatedAt && Date.parse(revision.committed_at) === Date.parse(gistCreatedAt);

  return (
    <>
      {formatDistanceToNow(revision.committed_at, { addSuffix: true })}
      {showChangeStats &&
        (isCreation ? (
          <span className="ml-2 text-muted-foreground">(Created)</span>
        ) : additions || deletions ? (
          <span className="ml-2">
            ({additions > 0 && <span className="text-green-500">+{additions}</span>}
            {additions > 0 && deletions > 0 && " "}
            {deletions > 0 && <span className="text-red-500">-{deletions}</span>})
          </span>
        ) : null)}
    </>
  );
}
