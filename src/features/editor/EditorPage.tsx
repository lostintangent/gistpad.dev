import UnsavedChangesGuard from "@/features/files/UnsavedChangesGuard";
import { Dashboard } from "./Dashboard";
import { MobilePanels } from "./SidePanel";
import { Sidebar } from "./Sidebar";
import Workspace from "./Workspace";
import ResearchStatus from "@/features/ai/research/ResearchStatus";
import { SpotifyPlayer } from "@/features/spotify/SpotifyPlayer";
import { Button } from "@/shared/ui/button";
import { useActiveFile, type ActiveFile } from "@/features/files/file";
import { getFileDisplayName, getGistDisplayName } from "@/shared/github";
import { useIsStarred } from "@/features/gists/queries";
import { useUpdatePreferences } from "@/features/account/queries";
import DeleteGistDialog from "@/features/gists/dialogs/DeleteGistDialog";
import EditTagsDialog from "@/features/gists/dialogs/EditTagsDialog";
import { mobilePanelAtom, zenModeAtom } from "./layout";
import { draftAtom } from "@/features/files/draft";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSelector } from "@tanstack/react-store";
import { EyeOff } from "lucide-react";
import { useEffect, useEffectEvent } from "react";

/**
 * Adds other people's files to the user's recently viewed files (unless they've starred
 * the gist), most recent first.
 */
function useRecordRecentlyViewed(file: ActiveFile) {
  const updatePreferences = useUpdatePreferences();
  const isStarred = useIsStarred(file.gistId);

  const shouldRecord = !!file.gist && !file.isLoading && file.isReadOnly && !isStarred;

  const record = useEffectEvent(() => {
    const { gist, filename } = file;
    if (!gist) return;

    updatePreferences(({ recentlyViewedGistFiles }) => ({
      recentlyViewedGistFiles: [
        {
          id: gist.id,
          description: gist.description || getFileDisplayName(filename),
          owner: gist.owner?.login ?? "unknown",
          ownerId: gist.owner?.id ?? 0,
          filename,
          viewedDate: new Date().toISOString(),
        },
        ...recentlyViewedGistFiles.filter(
          (recent) => recent.id !== gist.id || recent.filename !== filename,
        ),
      ].slice(0, 5),
    }));
  });

  useEffect(() => {
    if (shouldRecord) record();
  }, [shouldRecord, file.key]);
}

/** Exits zen mode (whose only other chrome is the status of the user's research and changes). */
function ZenModeControls() {
  const hasUnsavedChanges = useSelector(draftAtom, (draft) => draft !== null);

  return (
    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-2">
      <ResearchStatus />
      {hasUnsavedChanges && <span className="bg-blue-500 w-2 h-2 rounded-full" />}
      <Button variant="outline" size="sm" onClick={() => zenModeAtom.set(false)}>
        <EyeOff />
        Exit zen mode
      </Button>
    </div>
  );
}

export default function EditorPage() {
  const file = useActiveFile();
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);

  // (While there's no gist to show, e.g. for a new user, the gist list stays open)
  const mobilePanel = useSelector(mobilePanelAtom) ?? (file.gistId ? null : "sidebar");

  useRecordRecentlyViewed(file);

  const workspace = (
    <div className="relative min-w-0 flex-1 h-full">
      <Workspace />
      {isZenMode && <ZenModeControls />}
    </div>
  );

  return (
    <div className="fit-screen mx-auto max-w-500 p-2">
      <title>{file.gist ? `GistPad - ${getGistDisplayName(file.gist)}` : "GistPad"}</title>

      {/* The workspace is between two panels (which slide in, on mobile) */}
      {isMobile ? (
        <MobilePanels
          openPanel={
            mobilePanel === "sidebar" ? "left" : mobilePanel === "dashboard" ? "right" : null
          }
          onClose={() => mobilePanelAtom.set(null)}
          left={<Sidebar />}
          right={<Dashboard />}
        >
          {workspace}
        </MobilePanels>
      ) : (
        <div className="h-full flex">
          <Sidebar />
          {workspace}
          <Dashboard />
        </div>
      )}

      <UnsavedChangesGuard />
      <DeleteGistDialog />
      <EditTagsDialog />
      <SpotifyPlayer />
    </div>
  );
}
