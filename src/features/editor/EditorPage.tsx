import { AppHeader } from "./AppHeader";
import UnsavedChangesDialog from "./dialogs/UnsavedChangesDialog";
import Workspace from "./Workspace";
import GistList from "@/features/gists/list/GistList";
import { SpotifyPlayer } from "@/features/spotify/SpotifyPlayer";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { useDocument, useIsSaving, useSaveDocument, type GistDocument } from "./document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { getGistDisplayName } from "@/shared/github";
import { useStarredGists } from "@/features/gists/queries";
import { useRecordRecentlyViewed } from "@/features/session/queries";
import DeleteGistDialog from "@/features/gists/dialogs/DeleteGistDialog";
import { usePreferences } from "@/features/session/queries";
import { discardDraft, draftAtom, useDraft } from "./store";
import { mobileSidebarOpenAtom, sidebarCollapsedAtom, zenModeAtom } from "./store";
import { useBlocker } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
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
        discardDraft();
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

/** When the sidebar is collapsed, it can be revealed by hovering over the left edge of the screen. */
function SidebarHoverSheet() {
  const [isOpen, setIsOpen] = useState(false);

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
        className="w-[325px] border-r-0 p-0"
        onPointerLeave={() => setIsOpen(false)}
      >
        <GistList />
      </SheetContent>
    </Sheet>
  );
}

export default function EditorPage() {
  const doc = useDocument();
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);
  const isSidebarCollapsed = useSelector(sidebarCollapsedAtom);
  const isMobileSidebarOpen = useSelector(mobileSidebarOpenAtom);

  useRecentlyViewed(doc);

  // On mobile, either the gist list or the editor fills the screen.
  const showSidebar = isMobile
    ? isMobileSidebarOpen || !doc.gistId
    : !isSidebarCollapsed && !isZenMode;

  return (
    <div className="container h-screen grid grid-rows-[auto_1fr] gap-2">
      <title>{doc.gist ? `GistPad - ${getGistDisplayName(doc.gist)}` : "GistPad"}</title>

      {!isMobile && (isSidebarCollapsed || isZenMode) && <SidebarHoverSheet />}

      <AppHeader isGistListVisible={showSidebar} />

      <div
        className={`grid grid-rows-[minmax(0,1fr)] flex-1 min-h-0 ${isMobile ? "" : "transition-[grid-template-columns] duration-200 ease-in-out"} ${showSidebar && !isMobile ? "gap-2" : ""}`}
        style={{
          gridTemplateColumns: isMobile
            ? showSidebar
              ? "1fr 0px"
              : "0px 1fr"
            : `${showSidebar ? "325px" : "0px"} 1fr`,
        }}
      >
        <div
          className={`overflow-hidden ${isMobile ? "" : "transition-[opacity] duration-200 ease-in-out"} ${showSidebar ? "opacity-100" : "opacity-0"}`}
        >
          <GistList onCollapse={() => sidebarCollapsedAtom.set(true)} />
        </div>

        <div className={isMobile && showSidebar ? "hidden" : "min-w-0"}>
          <Workspace />
        </div>
      </div>

      <UnsavedChangesGuard doc={doc} />
      <DeleteGistDialog />
      <SpotifyPlayer />
    </div>
  );
}
