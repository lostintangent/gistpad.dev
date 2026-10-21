import { getRouteApi } from "@tanstack/react-router";
import { useIsMobile } from "@/shared/useMediaQuery";
import { closeComments } from "@/features/comments/store";
import { resolveEditorMode, type EditorMode } from "./preferences";

export { EDITOR_MODES, isEditorMode, type EditorMode } from "./preferences";

const editorRoute = getRouteApi("/_authenticated/{-$gistId}/{-$filePath}");

/**
 * The editor's mode (edit, preview or split), which is stored in the URL as `view` (when it
 * differs from the default), so that it can be shared and restored.
 */
export function useEditorMode() {
  const { view } = editorRoute.useSearch({ shouldThrow: false }) ?? {};
  const navigate = editorRoute.useNavigate();
  const isMobile = useIsMobile();

  // Wide screens have room for the editor and preview side by side, but mobile screens don't.
  const screenWidth = typeof window === "undefined" ? 0 : window.screen.width;
  const defaultMode = resolveEditorMode(undefined, isMobile, screenWidth);
  const mode = resolveEditorMode(view, isMobile, screenWidth);

  const setMode = (mode: EditorMode) => {
    if (isMobile) closeComments();
    return navigate({
      to: ".",
      search: (search) => ({ ...search, view: mode === defaultMode ? undefined : mode }),
      replace: true,
    });
  };

  return [mode, setMode] as const;
}
