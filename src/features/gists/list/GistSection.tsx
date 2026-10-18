import type { Gist } from "@/shared/github";
import { useActiveFile } from "@/features/files/file";
import { Archive, Star } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { GistItem } from "./GistItem";

const SECTIONS = {
  starred: { icon: <Star className="fill-yellow-400 text-yellow-400" />, title: "Starred gists" },
  archived: { icon: <Archive />, title: "Archived gists" },
};

/** A secondary list of gists (e.g. starred or archived gists), below the user's main gists. */
export function GistSection({
  section,
  gists,
  totalCount,
  isFiltered,
}: {
  section: keyof typeof SECTIONS;
  /** The gists that match the current filter. */
  gists: Gist[];
  totalCount: number;
  isFiltered: boolean;
}) {
  const { gistId: openGistId } = useActiveFile();

  return (
    <CollapsibleSection
      section={section}
      {...SECTIONS[section]}
      count={isFiltered ? `${gists.length} of ${totalCount}` : totalCount}
      containsOpenGist={gists.some(({ id }) => id === openGistId)}
      rowCount={gists.length}
    >
      {gists.length === 0 ? (
        <div className="p-2 text-muted-foreground text-center italic text-sm">
          No {section} gists match your filter
        </div>
      ) : (
        gists.map((gist) => (
          <GistItem key={gist.id} gist={gist} isOpen={gist.id === openGistId} compact />
        ))
      )}
    </CollapsibleSection>
  );
}
