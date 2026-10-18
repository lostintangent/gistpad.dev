import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useActiveFile, useIsSaving, useSaveFile } from "./file";
import { draftAtom, readDraft, useDraft } from "./draft";
import { usePreferences } from "@/features/account/queries";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useEffectEvent } from "react";

const AUTO_SAVE_DELAY = 5000;

/**
 * Keeps the user from losing their changes: by saving them when they leave the app (e.g. by
 * backgrounding it on mobile), and if they've enabled auto-save, after they stop editing and when
 * they leave the file. Otherwise, it asks them what to do with their changes before they leave
 * the file.
 */
export default function UnsavedChangesGuard() {
  const file = useActiveFile();
  const save = useSaveFile(file);
  const isSaving = useIsSaving(file);
  const { isAutoSaveEnabled } = usePreferences();
  const draftContent = useDraft(file)?.content;

  /** Saves the changes, if they can be saved without asking the user, and returns whether they were. */
  const saveChanges = async () => {
    // (Other people's gists need to be forked, and AI edits aren't saved until the user accepts them)
    const draft = readDraft(file);
    const canSave = !file.isReadOnly && !!draft && !draft.hasPendingAiEdit;

    if (canSave) await save();
    return canSave;
  };

  const autoSave = async () => isAutoSaveEnabled && (await saveChanges());

  const onStopEditing = useEffectEvent(() => void autoSave());
  const onLeaveApp = useEffectEvent(() => void saveChanges());

  useEffect(() => {
    if (draftContent === undefined) return;
    const timeout = setTimeout(onStopEditing, AUTO_SAVE_DELAY);
    return () => clearTimeout(timeout);
  }, [draftContent]);

  useEffect(() => {
    const onVisibilityChange = () => document.visibilityState === "hidden" && onLeaveApp();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const blocker = useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      const isLeavingFile = next.pathname !== current.pathname;
      if (!isLeavingFile || !draftAtom.get()) return false;

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
        file.isReadOnly
          ? undefined
          : async () => {
              await save();
              blocker.proceed?.();
            }
      }
    />
  );
}
