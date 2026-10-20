import { useHotkeys } from "@tanstack/react-hotkeys";
import { executeCommand, useRegisteredCommands } from "./registry";

export function CommandShortcuts() {
  const commands = useRegisteredCommands();
  useHotkeys(
    commands.flatMap((command) =>
      command.shortcut
        ? [
            {
              hotkey: command.shortcut,
              callback: () => void executeCommand(command.id),
            },
          ]
        : [],
    ),
  );
  return null;
}
