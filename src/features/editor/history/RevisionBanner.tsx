import { Button } from "@/shared/ui/button";
import type { GistDocument } from "../document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { updateDraft } from "../store";
import { History, RotateCcw, X } from "lucide-react";
import { revisionAtom, type Revision } from "./revision";
import { RevisionLabel } from "./RevisionLabel";

/** Indicates that a past revision of the document is being viewed, which can be restored. */
export function RevisionBanner({ doc, revision }: { doc: GistDocument; revision: Revision }) {
  const isMobile = useIsMobile();

  // (Restoring a revision that matches the document wouldn't change anything)
  const canRestore = !revision.isLoading && revision.content !== doc.savedContent;
  const close = () => revisionAtom.set(null);

  return (
    <div className="w-full shrink-0 bg-purple-100 dark:bg-purple-700/50 p-2 text-sm flex items-center justify-between">
      <div className="flex items-center flex-1 justify-center">
        <History className="h-4 w-4 mr-2" />
        <span>
          Viewing version from{" "}
          <RevisionLabel
            revision={revision}
            gistCreatedAt={doc.gist?.created_at}
            showChangeStats={!isMobile}
          />
        </span>
      </div>
      <div className="flex items-center gap-1">
        {canRestore && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              updateDraft(doc, { content: revision.content });
              close();
            }}
            title="Restore to this version"
          >
            <RotateCcw />
          </Button>
        )}
        <Button variant="ghost" size="icon-xs" onClick={close} title="Exit revision view">
          <X />
        </Button>
      </div>
    </div>
  );
}
