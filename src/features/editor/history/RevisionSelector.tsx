import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import type { GistDocument } from "../document";
import type { GistRevision } from "@/shared/github";
import { gistQueries } from "@/features/gists/queries";
import { revisionAtom } from "../store";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { RevisionLabel } from "./RevisionLabel";

const MAX_REVISIONS = 15;

/** The revisions that changed the gist's content (most recent first). */
const toContentRevisions = (revisions: GistRevision[]) =>
  revisions
    .filter(({ change_status }) => change_status.additions > 0 || change_status.deletions > 0)
    .sort((a, b) => Date.parse(b.committed_at) - Date.parse(a.committed_at))
    .slice(0, MAX_REVISIONS);

const CURRENT_VERSION = "current";

/** The menu items for viewing past revisions of the document (in a menu or submenu). */
export function RevisionItems({ doc }: { doc: GistDocument }) {
  const revisionId = useSelector(revisionAtom);
  const { data: revisions = [] } = useQuery({
    ...gistQueries.revisions(doc.gistId ?? ""),
    enabled: !!doc.gistId,
    select: toContentRevisions,
  });

  return (
    <DropdownMenuRadioGroup
      value={revisionId ?? CURRENT_VERSION}
      onValueChange={(id) => revisionAtom.set(id === CURRENT_VERSION ? null : id)}
    >
      <DropdownMenuRadioItem value={CURRENT_VERSION} closeOnClick>
        Current version
      </DropdownMenuRadioItem>
      <DropdownMenuSeparator />
      {revisions.map((revision) => (
        <DropdownMenuRadioItem
          key={revision.version}
          value={revision.version}
          className="whitespace-nowrap"
          closeOnClick
        >
          <RevisionLabel revision={revision} gistCreatedAt={doc.gist?.created_at} />
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
