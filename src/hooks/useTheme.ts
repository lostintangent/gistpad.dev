import {
  githubDark,
  githubLight,
  materialDark,
  materialLight,
  solarizedDark,
  solarizedLight,
  tokyoNight,
  tokyoNightDay,
  tokyoNightStorm,
  vscodeDark,
  vscodeLight,
} from "@uiw/codemirror-themes-all";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const prefersDarkMode = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const lightEditorThemes = {
  GitHub: githubLight,
  "Tokyo Day": tokyoNightDay,
  Solarized: solarizedLight,
  Material: materialLight,
  "VS Code": vscodeLight,
};

const darkEditorThemes = {
  GitHub: githubDark,
  "Tokyo Night": tokyoNight,
  "Tokyo Night Storm": tokyoNightStorm,
  Solarized: solarizedDark,
  Material: materialDark,
  "VS Code": vscodeDark,
};

/*
This hook does three things:
1. It adds the "dark" class to the <html> element in order to trigger dark mode styles.
2. It returns the current theme, and applicable editor themes.
3. It listens for changes to the user's system theme preference and updates the theme accordingly.
*/

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    prefersDarkMode() ? "dark" : "light"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (matches: boolean) => setTheme(matches ? "dark" : "light");
    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    applyTheme(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Return the theme value so that components that need it can use it.
  // For example, the Mermaid.js preview needs to know if we're in dark mode or not.
  const editorThemes = theme === "dark" ? darkEditorThemes : lightEditorThemes;
  return { theme, editorThemes };
}
