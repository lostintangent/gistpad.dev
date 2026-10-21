import { useState } from "react";
import type { Command } from "@/features/commands/command";
import { useCommands } from "@/features/commands/registry";
import type { AgentCommandSettings } from "../model/input";
import type { AgentMode, ComposerMode } from "../model/modes";
import { talkCommands } from "../talk/commands";
import type { TalkSession } from "../talk/talk";
import { composerModes, MODES } from "./modes";
import { BookOpen, FileText, Globe, Settings2 } from "lucide-react";

export type AgentSettingsView =
  "global-settings" | "file-settings" | "model-settings" | "analyze-style";

/**
 * The agent's commands, which the composer registers (and its mode menu lists): selecting a mode
 * (or, with text, sending it a prompt), the voice conversation, the user's slash commands, and
 * opening the agent's settings.
 */
export function useAgentCommands({
  isAvailable,
  hasFile,
  hasGists,
  isBusy,
  settings,
  mode,
  onSelectMode,
  talk,
  run,
}: {
  isAvailable: boolean;
  hasFile: boolean;
  hasGists: boolean;
  isBusy: boolean;
  settings: AgentCommandSettings;
  mode: ComposerMode;
  onSelectMode: (mode: ComposerMode) => void;
  talk: TalkSession;
  run: (prompt: string, mode: AgentMode | "auto") => unknown;
}) {
  const [settingsView, setSettingsView] = useState<AgentSettingsView | null>(null);
  const voice = talkCommands(talk);

  // (The menu's separators are kept, as nulls)
  const modes = composerModes(hasFile).map((value): Command | null => {
    if (value === null) return null;
    if (value === "talk") {
      return { ...voice.start, disabled: voice.start.disabled || !isAvailable || isBusy };
    }

    return {
      id: `agent.mode.${value}`,
      title: MODES[value].label,
      group: "Agent",
      icon: MODES[value].icon,
      checked: value === mode,
      disabled: !isAvailable || isBusy,
      acceptsInput: true,
      run: (input) => (input ? run(input, value) : onSelectMode(value)),
    };
  });

  const configure = (
    view: AgentSettingsView,
    title: string,
    icon: Command["icon"],
    disabled = false,
  ): Command => ({
    id: `agent.settings.${view}`,
    title,
    icon,
    group: "Settings",
    disabled,
    run: () => setSettingsView(view),
  });

  const configuration = {
    global: configure("global-settings", "Global agent settings", Globe),
    file: configure("file-settings", "File agent settings", FileText, !hasFile || !isAvailable),
    models: configure("model-settings", "Agent model settings", Settings2),
    style: configure("analyze-style", "Analyze writing style", BookOpen, !hasGists),
  };

  const slashCommands: Command[] =
    isAvailable && hasFile
      ? [...settings.edit.commands, ...settings.review.commands].map((command) => ({
          id: `agent.command.${command.defaultMode}.${command.name}`,
          group: "Agent",
          title: `/${command.name}`,
          icon: MODES[command.defaultMode].icon,
          detail: `${MODES[command.defaultMode].label}${command.description ? `: ${command.description}` : ""}`,
          disabled: isBusy,
          run: () => run(`/${command.name}`, command.defaultMode),
        }))
      : [];

  useCommands([
    ...modes.filter(
      (command): command is Command =>
        command !== null && (!talk.isActive || command.id !== voice.start.id),
    ),
    ...(talk.isActive ? [voice.mute, voice.end] : []),
    ...slashCommands,
    ...Object.values(configuration),
  ]);

  return {
    modes,
    voice,
    configuration,
    settingsView,
    closeSettings: () => setSettingsView(null),
  };
}

export type AgentComposerCommands = ReturnType<typeof useAgentCommands>;
