import UnsavedChangesGuard from "@/features/files/UnsavedChangesGuard";
import { DashboardPanel } from "./panels/DashboardPanel";
import { useIsMobile } from "@/shared/useMediaQuery";
import { Sidebar } from "./panels/Sidebar";
import Workspace from "./workspace/Workspace";
import ResearchStatus from "@/features/agent/research/ResearchStatus";
import { Button } from "@/shared/ui/button";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { useActiveFile, type ActiveFile } from "@/features/files/file";
import { getFileDisplayName, getGistDisplayName } from "@/shared/github";
import { useIsStarred } from "@/features/gists/queries";
import { useUpdatePreferences } from "@/features/account/queries";
import DeleteGistDialog from "@/features/gists/dialogs/DeleteGistDialog";
import EditTagsDialog from "@/features/gists/dialogs/EditTagsDialog";
import { mobilePanelAtom, zenModeAtom } from "./layout/state";
import { draftAtom } from "@/features/files/draft";
import { useSelector } from "@tanstack/react-store";
import { EyeOff } from "lucide-react";
import { useEffect, useEffectEvent, type CSSProperties } from "react";
import { useAccountCommands } from "@/features/account/commands";
import { useGistListCommands } from "@/features/gists/commands";
import { useLayoutCommands } from "./layout/commands";

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

export default function WorkbenchPage() {
  const file = useActiveFile();
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);
  const commandPages = useGistListCommands();
  useAccountCommands();
  useLayoutCommands();

  // (While there's no gist to show, e.g. for a new user, the gist list stays open)
  const mobilePanel = useSelector(mobilePanelAtom) ?? (file.gistId ? null : "sidebar");
  const panelOffset = mobilePanel === "sidebar" ? 0 : mobilePanel === "dashboard" ? 2 : 1;

  useRecordRecentlyViewed(file);

  return (
    <TooltipProvider>
      <title>{file.gist ? `GistPad - ${getGistDisplayName(file.gist)}` : "GistPad"}</title>
      <div className="fit-screen mx-auto max-w-500 p-2">
        <div
          className="workbench-layout h-full flex"
          style={{ "--mobile-panel-offset": panelOffset } as CSSProperties}
        >
          <div className="workbench-sidebar" inert={isMobile && mobilePanel !== "sidebar"}>
            <Sidebar />
          </div>
          <div className="workbench-workspace relative min-w-0 flex-1 h-full">
            <Workspace commandPages={commandPages} />
            {isZenMode && <ZenModeControls />}
            {mobilePanel && (
              <button
                className="absolute inset-0 z-20 md:hidden"
                aria-label="Close panel"
                onClick={() => mobilePanelAtom.set(null)}
              />
            )}
          </div>
          <div className="workbench-dashboard" inert={isMobile && mobilePanel !== "dashboard"}>
            <DashboardPanel />
          </div>
        </div>
      </div>

      <UnsavedChangesGuard />
      <DeleteGistDialog />
      <EditTagsDialog />
    </TooltipProvider>
  );
}
