import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import type { ActiveFile } from "@/features/files/file";
import { gistQueries } from "@/features/gists/queries";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { revisionAtom, toContentRevisions } from "./revision";
import { RevisionLabel } from "./RevisionLabel";

const CURRENT_VERSION = "current";

/** The menu items for viewing past revisions of the file (in a menu or submenu). */
export function RevisionItems({ file }: { file: ActiveFile }) {
  const revisionId = useSelector(revisionAtom);
  const { data: revisions = [] } = useQuery({
    ...gistQueries.revisions(file.gistId),
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
          <RevisionLabel revision={revision} gistCreatedAt={file.gist?.created_at} />
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
