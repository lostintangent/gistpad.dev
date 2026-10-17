import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { GistDocument } from "../document";
import type { GistRevision } from "@/shared/github";
import { gistQueries } from "@/features/gists/queries";
import { revisionAtom } from "../store";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import type { ReactElement, ReactNode } from "react";
import { RevisionLabel } from "./RevisionLabel";

const MAX_REVISIONS = 15;

/** The revisions that changed the gist's content (most recent first). */
const toContentRevisions = (revisions: GistRevision[]) =>
  revisions
    .filter(({ change_status }) => change_status.additions > 0 || change_status.deletions > 0)
    .sort((a, b) => Date.parse(b.committed_at) - Date.parse(a.committed_at))
    .slice(0, MAX_REVISIONS);

const CURRENT_VERSION = "current";

function RevisionItems({ doc }: { doc: GistDocument }) {
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

/** A menu for viewing past revisions of the document. */
export function RevisionMenu({
  doc,
  trigger,
  disabled,
}: {
  doc: GistDocument;
  trigger: ReactElement;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} disabled={disabled} />
      <DropdownMenuContent className="w-auto min-w-60">
        <RevisionItems doc={doc} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A submenu for viewing past revisions of the document (within another menu). */
export function RevisionSubmenu({ doc, children }: { doc: GistDocument; children: ReactNode }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{children}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-auto min-w-60">
        <RevisionItems doc={doc} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
