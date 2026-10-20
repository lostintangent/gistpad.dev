import type { Command } from "@/features/commands/command";
import { LogOut } from "lucide-react";
import { signOut, usePreferences, useUpdatePreferences, type Preferences } from "./queries";

type BooleanPreference = {
  [Key in keyof Preferences]: Preferences[Key] extends boolean ? Key : never;
}[keyof Preferences];

type Setting = readonly [BooleanPreference, string];

const GENERAL_SETTINGS: Setting[] = [
  ["isAutoSaveEnabled", "Auto-save changes"],
  ["isSpellcheckEnabled", "Enable spell checking"],
  ["showLineNumbers", "Show line numbers"],
  ["showFormattingToolbar", "Show formatting toolbar"],
];

const ADVANCED_SETTINGS: (Setting | null)[] = [
  ["showStarredGists", "Show starred gists"],
  ["showArchivedGists", "Show archived gists"],
  null,
  ["showDiffs", "Enable diff tracking"],
  ["showFrontmatter", "Show frontmatter"],
  ["showInlineComments", "Show inline comments"],
  null,
  ["pasteImagesAsHtml", "Paste images as HTML"],
];

export function useAccountSettingsCommands() {
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const setting = ([key, title]: Setting): Command => ({
    id: `setting.${key}`,
    title,
    group: "Settings",
    checked: preferences[key],
    run: () => updatePreferences((current) => ({ [key]: !current[key] })),
  });

  return {
    general: GENERAL_SETTINGS.map(setting),
    advanced: ADVANCED_SETTINGS.map((item) => item && setting(item)),
    signOut: {
      id: "account.signOut",
      title: "Sign out",
      group: "Account",
      icon: LogOut,
      run: signOut,
    } satisfies Command,
  };
}
