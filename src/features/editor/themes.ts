import { githubDarkInit, githubLightInit } from "@uiw/codemirror-theme-github";
import { useIsDarkMode } from "@/shared/useMediaQuery";

// The editor uses GitHub's colors, but on the app's background (instead of GitHub's)
const settings = { background: "var(--background)", gutterBackground: "var(--background)" };

const lightEditorTheme = githubLightInit({ settings });
const darkEditorTheme = githubDarkInit({ settings });

/** The editor's theme, which matches the system's color scheme (which the app follows). */
export function useEditorTheme() {
  return useIsDarkMode() ? darkEditorTheme : lightEditorTheme;
}
