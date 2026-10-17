import { editorRoute, type EditorMode } from "@/router";
import { useNavigate } from "@tanstack/react-router";
import { useIsMobile } from "@/shared/useMediaQuery";

/**
 * The editor's view mode (edit, preview or split), which is stored in the URL (when it differs
 * from the default), so that it can be shared and restored.
 */
export function useEditorMode() {
  const { view } = editorRoute.useSearch();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Wide screens have room for the editor and preview side by side, but mobile screens don't.
  const defaultMode: EditorMode = !isMobile && window.screen.width > 1500 ? "split" : "edit";
  const mode: EditorMode = isMobile && view === "split" ? "preview" : (view ?? defaultMode);

  const setMode = (mode: EditorMode) =>
    navigate({
      to: ".",
      search: (search) => ({ ...search, view: mode === defaultMode ? undefined : mode }),
      replace: true,
    });

  return [mode, setMode] as const;
}

/** The heading (in the preview) that the user navigated to, which is stored in the URL. */
export function useSelectedHeading() {
  const { heading } = editorRoute.useSearch();
  const navigate = useNavigate();

  const selectHeading = (heading: string | undefined) =>
    navigate({ to: ".", search: (search) => ({ ...search, heading }), replace: true });

  return [heading, selectHeading] as const;
}
