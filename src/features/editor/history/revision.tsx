import type { GistDocument } from "../document";
import { gistQueries } from "@/features/gists/queries";
import { useQuery } from "@tanstack/react-query";
import { createAtom, useSelector } from "@tanstack/react-store";

/** The past revision of the open document that's being viewed (if any), which is reset when it's closed. */
export const revisionAtom = createAtom<string | null>(null);

/** Whether a past revision of the open document is being viewed. */
export function useIsViewingRevision() {
  return useSelector(revisionAtom, (version) => version !== null);
}

/** The document's content, as of a revision. */
function useRevisionContent(doc: GistDocument, version: string | undefined) {
  return useQuery({
    ...gistQueries.revision(doc.gistId, version),
    select: (gist) => gist.files[doc.filename]?.content ?? "",
  });
}

/**
 * The past revision of the document that's being viewed (if any), along with its content, and
 * the content of the revision before it (which its changes are shown against).
 */
export function useRevision(doc: GistDocument) {
  const version = useSelector(revisionAtom);
  const { data: revisions = [] } = useQuery({
    ...gistQueries.revisions(doc.gistId),
    // (Revisions are only needed while viewing one)
    enabled: !!version,
  });

  const index = revisions.findIndex((revision) => revision.version === version);
  const revision = revisions[index];
  const previousVersion = revision && revisions[index + 1]?.version;

  const content = useRevisionContent(doc, revision?.version);
  const previousContent = useRevisionContent(doc, previousVersion);

  if (!revision) return null;

  return {
    ...revision,
    content: content.data ?? "",
    previousContent: previousContent.data ?? "",
    isLoading: content.isPending || (!!previousVersion && previousContent.isPending),
  };
}

export type Revision = NonNullable<ReturnType<typeof useRevision>>;
