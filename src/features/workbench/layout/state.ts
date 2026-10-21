import { persistedAtom } from "@/shared/persistedAtom";
import { MOBILE_MEDIA_QUERY } from "@/shared/useMediaQuery";
import { commentsPanelOpenAtom } from "@/features/comments/store";
import { createAtom } from "@tanstack/react-store";
import { LAYOUT_SETTINGS, type LayoutSetting } from "./preferences";

export { DASHBOARD_WIDTH, SIDEBAR_WIDTH } from "./preferences";

// The workbench's layout, where the workspace is beside two panels: the sidebar (i.e. the gist
// list) and the dashboard. On desktop, they're sized in pixels (rather than as a percentage),
// so their widths survive window resizes, and the workspace's panes divide whatever's left.

const layoutAtom = <T>({ key, defaultValue, ...serializer }: LayoutSetting<T>) =>
  persistedAtom(key, defaultValue, serializer);

/** A panel's width (desktop only), which is kept while it's collapsed or closed. */
export const sidebarWidthAtom = layoutAtom(LAYOUT_SETTINGS.sidebarWidth);

/** Whether the sidebar is collapsed into its rail (desktop only). */
export const sidebarCollapsedAtom = layoutAtom(LAYOUT_SETTINGS.sidebarCollapsed);

export const dashboardWidthAtom = layoutAtom(LAYOUT_SETTINGS.dashboardWidth);

/** Whether the dashboard is open (desktop only). */
export const dashboardOpenAtom = layoutAtom(LAYOUT_SETTINGS.dashboardOpen);

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
export const editorPaneSizeAtom = layoutAtom(LAYOUT_SETTINGS.editorPaneSize);
