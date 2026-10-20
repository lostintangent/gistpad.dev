import { persistedAtom } from "@/shared/persistedAtom";
import { MOBILE_MEDIA_QUERY } from "@/shared/useMediaQuery";
import { commentsPanelOpenAtom } from "@/features/comments/store";
import { createAtom } from "@tanstack/react-store";

// The workbench's layout, where the workspace is beside two panels: the sidebar (i.e. the gist
// list) and the dashboard. On desktop, they're sized in pixels (rather than as a percentage),
// so their widths survive window resizes, and the workspace's panes divide whatever's left.

export const SIDEBAR_WIDTH = { min: 250, max: 480 };
export const DASHBOARD_WIDTH = { min: SIDEBAR_WIDTH.min, max: 600 };

/** A panel's width (desktop only), which is kept while it's collapsed or closed. */
const persistedWidthAtom = (
  key: string,
  initialWidth: number,
  { min, max }: typeof SIDEBAR_WIDTH,
) =>
  persistedAtom(key, initialWidth, {
    parse: (value) => {
      const width = Number(value);
      if (!Number.isFinite(width)) throw new Error(`Invalid width: ${value}`);
      return Math.min(max, Math.max(min, width));
    },
    stringify: String,
  });

export const sidebarWidthAtom = persistedWidthAtom("gistpad-sidebar-width", 325, SIDEBAR_WIDTH);

/** Whether the sidebar is collapsed into its rail (desktop only). */
export const sidebarCollapsedAtom = persistedAtom("gistpad-sidebar-collapsed", false);

export const dashboardWidthAtom = persistedWidthAtom(
  "gistpad-dashboard-width",
  400,
  DASHBOARD_WIDTH,
);

/** Whether the dashboard is open (desktop only). */
export const dashboardOpenAtom = persistedAtom("gistpad-dashboard-open", false);

/** The panel that's open beside the editor (mobile only), since only one can be at a time. */
export const mobilePanelAtom = createAtom<"sidebar" | "dashboard" | null>(null);

/** On mobile, files take up the whole screen, so close the panels that cover them (e.g. to open one). */
export function closeMobilePanels() {
  if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches) return;

  mobilePanelAtom.set(null);
  commentsPanelOpenAtom.set(false);
}

export const zenModeAtom = createAtom(false);

/** The width of the editor pane (as a percentage), when it's split with the preview. */
export const editorPaneSizeAtom = persistedAtom("gistpad-editor-width", 50);
