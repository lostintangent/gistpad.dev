// Local layout settings are shared by the first-paint shell and the live workbench.
// Keep this module independent of React and stores so the shell can read them before the app loads.

export const SIDEBAR_WIDTH = { min: 250, max: 480 };
export const DASHBOARD_WIDTH = { min: SIDEBAR_WIDTH.min, max: 600 };

/** The width of the collapsed rail (one action between two insets). */
export const RAIL_WIDTH = 40;

/** Widths use raw numbers in storage and stay within the panel's resize limits. */
function parsePanelWidth(value: string, { min, max }: typeof SIDEBAR_WIDTH) {
  const width = Number(value);
  if (!Number.isFinite(width)) throw new Error(`Invalid width: ${value}`);
  return Math.min(max, Math.max(min, width));
}

const parseLayoutFlag = (value: string) => JSON.parse(value) === true;

export const LAYOUT_SETTINGS = {
  sidebarWidth: {
    key: "gistpad-sidebar-width",
    defaultValue: 325,
    parse: (value: string) => parsePanelWidth(value, SIDEBAR_WIDTH),
  },
  sidebarCollapsed: {
    key: "gistpad-sidebar-collapsed",
    defaultValue: false,
    parse: parseLayoutFlag,
  },
  dashboardWidth: {
    key: "gistpad-dashboard-width",
    defaultValue: 400,
    parse: (value: string) => parsePanelWidth(value, DASHBOARD_WIDTH),
  },
  dashboardOpen: {
    key: "gistpad-dashboard-open",
    defaultValue: false,
    parse: parseLayoutFlag,
  },
  editorPaneSize: {
    key: "gistpad-editor-width",
    defaultValue: 50,
    parse: (value: string) => parsePanelWidth(value, { min: 25, max: 75 }),
  },
};

export interface LayoutSetting<T> {
  key: string;
  defaultValue: T;
  parse: (value: string) => T;
}

export const EDITOR_MODES = ["edit", "preview", "split"] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];
export const isEditorMode = (value: unknown): value is EditorMode =>
  EDITOR_MODES.some((mode) => mode === value);

export function resolveEditorMode(
  view: unknown,
  isMobile: boolean,
  screenWidth: number,
): EditorMode {
  const mode = isEditorMode(view) ? view : !isMobile && screenWidth > 1500 ? "split" : "edit";
  return isMobile && mode === "split" ? "preview" : mode;
}

/** The sizes of the editor and preview panes (as percentages), for a mode. */
export function getPaneLayout(mode: EditorMode, editorSize: number) {
  const editor = mode === "edit" ? 100 : mode === "preview" ? 0 : editorSize;
  return { editor, preview: 100 - editor };
}

/** Reading local layout must also work when storage is blocked, empty, or malformed. */
export function readLayoutPreferences() {
  const read = <T>({ key, defaultValue, parse }: LayoutSetting<T>): T => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? defaultValue : parse(value);
    } catch {
      return defaultValue;
    }
  };

  return {
    sidebarWidth: read(LAYOUT_SETTINGS.sidebarWidth),
    sidebarCollapsed: read(LAYOUT_SETTINGS.sidebarCollapsed),
    dashboardWidth: read(LAYOUT_SETTINGS.dashboardWidth),
    dashboardOpen: read(LAYOUT_SETTINGS.dashboardOpen),
    editorPaneSize: read(LAYOUT_SETTINGS.editorPaneSize),
  };
}
