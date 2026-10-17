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
import { useIsDarkMode } from "@/shared/useMediaQuery";

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

/** The editor themes that match the system's color scheme (which the app follows). */
export function useEditorThemes() {
  return useIsDarkMode() ? darkEditorThemes : lightEditorThemes;
}
