import UnsavedChangesDialog from "./dialogs/UnsavedChangesDialog";
import { Dashboard } from "./Dashboard";
import { MobilePanels } from "./SidePanel";
import { Sidebar } from "./Sidebar";
import Workspace from "./Workspace";
import ResearchStatus from "@/features/ai/research/ResearchStatus";
import { SpotifyPlayer } from "@/features/spotify/SpotifyPlayer";
import { Button } from "@/shared/ui/button";
import { useDocument, useIsSaving, useSaveDocument, type GistDocument } from "./document";
import { getFileDisplayName, getGistDisplayName } from "@/shared/github";
import { useIsStarred } from "@/features/gists/queries";
import { usePreferences, useUpdatePreferences } from "@/features/account/queries";
import DeleteGistDialog from "@/features/gists/dialogs/DeleteGistDialog";
import EditTagsDialog from "@/features/gists/dialogs/EditTagsDialog";
import { mobilePanelAtom, zenModeAtom } from "./layout";
import { draftAtom, readDraft, useDraft } from "./store";
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
  const draftContent = useDraft(doc)?.content;

  /** Saves the changes, if they can be saved automatically, and returns whether they were. */
  const autoSave = async () => {
    // (AI edits aren't saved until the user accepts them)
    const draft = readDraft(doc);
    const canAutoSave = isAutoSaveEnabled && !doc.isReadOnly && !!draft && !draft.hasPendingAiEdit;

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

/**
 * Adds other people's gist files to the user's recently viewed files (unless they've starred
 * the gist), most recent first.
 */
function useRecordRecentlyViewed(doc: GistDocument) {
  const updatePreferences = useUpdatePreferences();
  const isStarred = useIsStarred(doc.gistId);

  const shouldRecord = !!doc.gist && !doc.isLoading && doc.isReadOnly && !isStarred;

  const record = useEffectEvent(() => {
    const { gist, filename } = doc;
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
          (file) => file.id !== gist.id || file.filename !== filename,
        ),
      ].slice(0, 5),
    }));
  });

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

  useRecordRecentlyViewed(doc);

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

      <UnsavedChangesGuard doc={doc} />
      <DeleteGistDialog />
      <EditTagsDialog />
      <SpotifyPlayer />
    </div>
  );
}
