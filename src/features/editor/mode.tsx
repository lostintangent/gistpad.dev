import { getRouteApi } from "@tanstack/react-router";
import { useIsMobile } from "@/shared/useMediaQuery";

export const EDITOR_MODES = ["edit", "preview", "split"] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];

const editorRoute = getRouteApi("/authenticated/{-$gistId}/{-$filePath}");

/**
 * The editor's mode (edit, preview or split), which is stored in the URL as `view` (when it
 * differs from the default), so that it can be shared and restored.
 */
export function useEditorMode() {
  const { view } = editorRoute.useSearch();
  const navigate = editorRoute.useNavigate();
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
