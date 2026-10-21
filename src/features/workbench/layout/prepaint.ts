import { getPaneLayout, RAIL_WIDTH, readLayoutPreferences, resolveEditorMode } from "./preferences";

/** Applies saved workbench layout before paint, without loading React or stores. */
export function prepaintWorkbench(root: HTMLElement, url: URL) {
  const layout = readLayoutPreferences();
  const mode = resolveEditorMode(
    url.searchParams.get("view"),
    matchMedia("(max-width: 767px)").matches,
    screen.width,
  );

  root.style.cssText += `
  --startup-mobile-panel-offset: ${url.pathname === "/" ? 0 : 1};
  --startup-sidebar-width: ${layout.sidebarCollapsed ? RAIL_WIDTH : layout.sidebarWidth}px;
  --startup-dashboard-width: ${layout.dashboardWidth}px;
  --initial-editor-size: ${getPaneLayout(mode, layout.editorPaneSize).editor}%;
  --initial-editor-divider: ${mode === "split" ? "flex" : "none"};
`;
  root.dataset.startupSidebarCollapsed = String(layout.sidebarCollapsed);
  root.dataset.startupDashboardOpen = String(layout.dashboardOpen);
}
