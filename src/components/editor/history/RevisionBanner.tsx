import { Button } from "@/components/ui/button";
import { GistRevision } from "@/lib/github";
import { History, RotateCcw, X } from "lucide-react";
import { RevisionLabel } from "./RevisionLabel";

export function RevisionBanner({
    revision,
    gistCreatedAt,
    gistUpdatedAt,
    onClearRevision,
    onRestoreRevision,
    showChangeStats = true,
}: {
    revision: GistRevision;
    gistCreatedAt: string;
    gistUpdatedAt: string;
    onClearRevision: () => void;
    onRestoreRevision: () => void;
    showChangeStats?: boolean;
}) {
    if (!revision) return null;

    // Check if this revision matches the last update time
    const isCurrentVersion = new Date(revision.committed_at).getTime() === new Date(gistUpdatedAt).getTime();

    return (
        <div className="absolute z-10 w-full bg-purple-100 dark:bg-purple-700/50 p-2 text-sm flex items-center justify-between">
            <div className="flex items-center flex-1 justify-center">
                <History className="h-4 w-4 mr-2" />
                <span>
                    Viewing version from{" "}
                    <RevisionLabel
                        revision={revision}
                        gistCreatedAt={gistCreatedAt}
                        showChangeStats={showChangeStats}
                    />
                </span>
            </div>
            <div className="flex items-center gap-1">
                {!isCurrentVersion && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-3 mr-1"
                        onClick={onRestoreRevision}
                        title="Restore to this version"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-3 mr-1"
                    onClick={onClearRevision}
                    title="Exit revision view"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
