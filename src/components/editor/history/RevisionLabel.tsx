import { GistRevision } from "@/lib/github";
import { formatDistanceToNow } from "date-fns";

export function RevisionLabel({
    revision,
    gistCreatedAt,
    showChangeStats = true,
}: {
    revision: GistRevision;
    gistCreatedAt: string;
    showChangeStats?: boolean;
}) {
    return (
        <>
            {formatDistanceToNow(new Date(revision.committed_at), {
                addSuffix: true,
            })}
            {showChangeStats &&
                (gistCreatedAt &&
                    new Date(revision.committed_at).getTime() ===
                    new Date(gistCreatedAt).getTime() ? (
                    <span className="ml-2 text-muted-foreground">(Created)</span>
                ) : revision.change_status &&
                    (revision.change_status.additions ||
                        revision.change_status.deletions) ? (
                    <span className="ml-2">
                        (
                        {revision.change_status.additions > 0 && (
                            <span className="text-green-500">
                                +{revision.change_status.additions}
                            </span>
                        )}
                        {revision.change_status.additions > 0 &&
                            revision.change_status.deletions > 0 &&
                            " "}
                        {revision.change_status.deletions > 0 && (
                            <span className="text-red-500">
                                -{revision.change_status.deletions}
                            </span>
                        )}
                        )
                    </span>
                ) : null)}
        </>
    );
}
