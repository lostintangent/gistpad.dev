import UnsavedChangesDialog from "./dialogs/UnsavedChangesDialog";
import { NewsDashboard } from "./NewsDashboard";
import { MobilePanels } from "./SidePanel";
import { Sidebar } from "./Sidebar";
import Workspace from "./Workspace";
import ResearchStatus from "@/features/ai/research/ResearchStatus";
import { SpotifyPlayer } from "@/features/spotify/SpotifyPlayer";
import { Button } from "@/shared/ui/button";
import { useDocument, useIsSaving, useSaveDocument, type GistDocument } from "./document";
import { getGistDisplayName } from "@/shared/github";
import { useStarredGists } from "@/features/gists/queries";
import { usePreferences, useRecordRecentlyViewed } from "@/features/account/queries";
import DeleteGistDialog from "@/features/gists/dialogs/DeleteGistDialog";
import { draftAtom, mobilePanelAtom, useDraft, zenModeAtom } from "./store";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useBlocker } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { EyeOff } from "lucide-react";
import { useEffect, useEffectEvent } from "react";

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

export default function EditorPage() {
  const doc = useDocument();
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);

  // (While there's no gist to show, e.g. for a new user, the gist list stays open)
  const mobilePanel = useSelector(mobilePanelAtom) ?? (doc.gistId ? null : "sidebar");

  useRecentlyViewed(doc);

  const workspace = (
    <div className="relative min-w-0 flex-1 h-full">
      <Workspace />
      {isZenMode && <ZenModeControls />}
    </div>
  );

  return (
    <div className="fit-screen mx-auto max-w-500 p-2">
      <title>{doc.gist ? `GistPad - ${getGistDisplayName(doc.gist)}` : "GistPad"}</title>

      {/* The workspace is between two panels (which slide in, on mobile) */}
      {isMobile ? (
        <MobilePanels
          openPanel={
            mobilePanel === "sidebar" ? "left" : mobilePanel === "dashboard" ? "right" : null
          }
          onClose={() => mobilePanelAtom.set(null)}
          left={<Sidebar />}
          right={<NewsDashboard />}
        >
          {workspace}
        </MobilePanels>
      ) : (
        <div className="h-full flex">
          <Sidebar />
          {workspace}
          <NewsDashboard />
        </div>
      )}

      <UnsavedChangesGuard doc={doc} />
      <DeleteGistDialog />
      <SpotifyPlayer />
    </div>
  );
}
