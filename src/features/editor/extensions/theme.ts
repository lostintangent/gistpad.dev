import { EditorView } from "@codemirror/view";
import { githubDarkInit, githubLightInit } from "@uiw/codemirror-theme-github";

// The editor uses GitHub's colors, but on the app's background (instead of GitHub's)
const settings = { background: "var(--background)", gutterBackground: "var(--background)" };

// The editor fills its pane (and scrolls within it), and isn't outlined when it's focused (as
// CodeMirror does by default), since the workspace frames it
const layout = EditorView.theme({
  "&": { height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
});

/** The editor's themes, for each color scheme (which follows the system's). */
export const lightTheme = [githubLightInit({ settings }), layout];
export const darkTheme = [githubDarkInit({ settings }), layout];
