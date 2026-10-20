import { useCommands } from "@/features/commands/registry";
import { useAccountSettingsCommands } from "./settings";

/** The commands for the user's settings (which toggle them), and their account. */
export function useAccountCommands() {
  const commands = useAccountSettingsCommands();

  useCommands(
    [...commands.general, ...commands.advanced, commands.signOut].filter(
      (command) => command !== null,
    ),
  );
}
