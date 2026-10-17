import { Button } from "@/shared/ui/button";
import type { GistDocument } from "../document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { gistQueries } from "@/features/gists/queries";
import { revisionAtom, updateDraft } from "../store";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { History, RotateCcw, X } from "lucide-react";
import { RevisionLabel } from "./RevisionLabel";

/** Indicates that a past revision of the document is being viewed, which can be restored. */
export function RevisionBanner({
  doc,
  content,
}: {
  doc: GistDocument;
  /** The revision's content, which replaces the document's content when it's restored. */
  content: string;
}) {
  const revisionId = useSelector(revisionAtom);
  const isMobile = useIsMobile();
  const { data: revision } = useQuery({
    ...gistQueries.revisions(doc.gistId ?? ""),
    select: (revisions) => revisions.find(({ version }) => version === revisionId),
  });

  if (!revision || !doc.gist) return null;

  const isCurrentVersion = Date.parse(revision.committed_at) === Date.parse(doc.gist.updated_at);
  const close = () => revisionAtom.set(null);

  return (
    <div className="w-full shrink-0 bg-purple-100 dark:bg-purple-700/50 p-2 text-sm flex items-center justify-between">
      <div className="flex items-center flex-1 justify-center">
        <History className="h-4 w-4 mr-2" />
        <span>
          Viewing version from{" "}
          <RevisionLabel
            revision={revision}
            gistCreatedAt={doc.gist.created_at}
            showChangeStats={!isMobile}
          />
        </span>
      </div>
      <div className="flex items-center gap-1">
        {!isCurrentVersion && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              updateDraft(doc.documentKey, doc.savedContent, { content });
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
