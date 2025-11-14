import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GistRevision } from "@/lib/github";
import { useMemo } from "react";
import { RevisionLabel } from "./RevisionLabel";

interface RevisionSelectorProps {
  children: React.ReactNode;
  revisions: GistRevision[] | null;
  isLoading: boolean;
  selectedRevisionId: string | null;
  onSelectRevision: (revisionId: string | null) => void;
  gistCreatedAt?: string;
  subMenu?: boolean;
}

export default function RevisionSelector({
  children,
  revisions,
  isLoading = false,
  selectedRevisionId,
  onSelectRevision,
  gistCreatedAt,
  subMenu = false,
}: RevisionSelectorProps) {
  const sortedRevisions = useMemo(() => {
    if (!revisions) return [];
    const sorted = [...revisions]
      .filter(
        (revision) =>
          revision.change_status &&
          (revision.change_status.additions > 0 ||
            revision.change_status.deletions > 0)
      )
      .sort(
        (a, b) =>
          new Date(b.committed_at).getTime() -
          new Date(a.committed_at).getTime()
      )
      .slice(0, 15);
    return sorted;
  }, [revisions]);

  const Menu = subMenu ? DropdownMenuSub : DropdownMenu;
  const Trigger = subMenu ? DropdownMenuSubTrigger : DropdownMenuTrigger;
  const Content = subMenu ? DropdownMenuSubContent : DropdownMenuContent;

  return (
    <Menu>
      <Trigger disabled={isLoading || !revisions}>
        {children}
      </Trigger>
      <Content>
        <DropdownMenuItem
          onClick={() => onSelectRevision(null)}
          className={
            !selectedRevisionId ? "bg-primary text-primary-foreground" : ""
          }
        >
          Current version
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {sortedRevisions.map((revision) => (
          <DropdownMenuItem
            key={revision.version}
            onClick={() => onSelectRevision(revision.version)}
            className={
              selectedRevisionId === revision.version
                ? "bg-primary text-primary-foreground"
                : ""
            }
          >
            <RevisionLabel revision={revision} gistCreatedAt={gistCreatedAt} />
          </DropdownMenuItem>
        ))}
      </Content>
    </Menu>
  );
}
