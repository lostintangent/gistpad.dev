import UnsavedChangesDialog from "./dialogs/UnsavedChangesDialog";
import { Sidebar } from "./Sidebar";
import { SidebarResizer } from "./SidebarResizer";
import Workspace from "./Workspace";
import ResearchStatus from "@/features/ai/research/ResearchStatus";
import { SpotifyPlayer } from "@/features/spotify/SpotifyPlayer";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { useDocument, useIsSaving, useSaveDocument, type GistDocument } from "./document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { getGistDisplayName } from "@/shared/github";
import { useStarredGists } from "@/features/gists/queries";
import { usePreferences, useRecordRecentlyViewed } from "@/features/account/queries";
import DeleteGistDialog from "@/features/gists/dialogs/DeleteGistDialog";
import { draftAtom, useDraft } from "./store";
import {
  mobileSidebarOpenAtom,
  sidebarCollapsedAtom,
  sidebarWidthAtom,
  zenModeAtom,
} from "./store";
import { useBlocker } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import { EyeOff } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

const AUTO_SAVE_DELAY = 5000;

/**
 * Keeps the user from losing their changes: by saving them automatically (if they've enabled that),
 * after they stop editing, and when they leave the page or document. Otherwise, it asks them what
 * to do with their changes before they leave the document.
 */
function UnsavedChangesGuard({ doc }: { doc: GistDocument }) {
  const save = useSaveDocument(doc);
  const isSaving = useIsSaving(doc);
  const { isAutoSaveEnabled } = usePreferences();
  const draftContent = useDraft(doc.documentKey)?.content;

  /** Saves the changes, if they can be saved automatically, and returns whether they were. */
  const autoSave = async () => {
    // (AI edits aren't saved until the user accepts them)
    const draft = draftAtom.get();
    const canAutoSave =
      isAutoSaveEnabled &&
      !doc.isReadOnly &&
      draft?.documentKey === doc.documentKey &&
      !draft.hasPendingAiEdit;

    if (canAutoSave) await save();
    return canAutoSave;
  };

  const onStopEditing = useEffectEvent(() => void autoSave());

  useEffect(() => {
    if (draftContent === undefined) return;
    const timeout = setTimeout(onStopEditing, AUTO_SAVE_DELAY);
    return () => clearTimeout(timeout);
  }, [draftContent]);

  useEffect(() => {
    const onVisibilityChange = () => document.visibilityState === "hidden" && onStopEditing();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const blocker = useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      const isLeavingDocument = next.pathname !== current.pathname;
      if (!isLeavingDocument || !draftAtom.get()) return false;

      return !(await autoSave());
    },
    enableBeforeUnload: () => draftAtom.get() !== null,
    withResolver: true,
  });

  return (
    <UnsavedChangesDialog
      isOpen={blocker.status === "blocked"}
      isSaving={isSaving}
      onCancel={() => blocker.reset?.()}
      onDiscard={() => {
        draftAtom.set(null);
        blocker.proceed?.();
      }}
      onSave={
        doc.isReadOnly
          ? undefined
          : async () => {
              await save();
              blocker.proceed?.();
            }
      }
    />
  );
}

/** Adds other people's gists to the user's recently viewed list (unless they've starred it). */
function useRecentlyViewed(doc: GistDocument) {
  const recordRecentlyViewed = useRecordRecentlyViewed();
  const starredGists = useStarredGists();

  const shouldRecord =
    !!doc.gist &&
    !doc.isLoading &&
    doc.isReadOnly &&
    !starredGists.some((gist) => gist.id === doc.gistId);

  const record = useEffectEvent(() => recordRecentlyViewed(doc.gist!, doc.filename));

  useEffect(() => {
    if (shouldRecord) record();
  }, [shouldRecord, doc.documentKey]);
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

/** In zen mode, the sidebar is hidden, but it can be revealed by hovering over the screen's left edge. */
function SidebarHoverSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const width = useSelector(sidebarWidthAtom);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (event.clientX <= 30) setIsOpen(true);
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="border-r-0 p-0"
        style={{ width }}
        onPointerLeave={() => setIsOpen(false)}
      >
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}

export default function EditorPage() {
  const doc = useDocument();
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);
  const isSidebarCollapsed = useSelector(sidebarCollapsedAtom);
  const sidebarWidth = useSelector(sidebarWidthAtom);
  const isMobileSidebarOpen = useSelector(mobileSidebarOpenAtom);

  useRecentlyViewed(doc);

  // On mobile, either the gist list or the editor fills the screen. And on desktop, the sidebar
  // is hidden in zen mode (and otherwise, it's either expanded or collapsed into a rail).
  const showSidebar = isMobile ? isMobileSidebarOpen || !doc.gistId : !isZenMode;

  return (
    <div className="container h-screen">
      <title>{doc.gist ? `GistPad - ${getGistDisplayName(doc.gist)}` : "GistPad"}</title>

      {!isMobile && isZenMode && <SidebarHoverSheet />}

      <div
        className={cn("h-full", isMobile ? "grid grid-rows-[minmax(0,1fr)]" : "flex")}
        style={isMobile ? { gridTemplateColumns: showSidebar ? "1fr 0px" : "0px 1fr" } : undefined}
      >
        {isMobile ? (
          <div className={cn("overflow-hidden", !showSidebar && "opacity-0")}>
            <Sidebar />
          </div>
        ) : (
          <SidebarResizer
            width={sidebarWidth}
            isCollapsed={isSidebarCollapsed}
            isHidden={!showSidebar}
            onWidthChange={(width) => sidebarWidthAtom.set(width)}
            onCollapsedChange={(isCollapsed) => sidebarCollapsedAtom.set(isCollapsed)}
          >
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onCollapsedChange={(isCollapsed) => sidebarCollapsedAtom.set(isCollapsed)}
            />
          </SidebarResizer>
        )}

        <div className={isMobile && showSidebar ? "hidden" : "relative min-w-0 flex-1"}>
          <Workspace />
          {isZenMode && <ZenModeControls />}
        </div>
      </div>

      <UnsavedChangesGuard doc={doc} />
      <DeleteGistDialog />
      <SpotifyPlayer />
    </div>
  );
}
