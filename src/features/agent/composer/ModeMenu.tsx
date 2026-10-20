import type { Command } from "@/features/commands/command";
import { CommandDropdownItem } from "@/features/commands/CommandDropdownItem";
import {
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/ui/dropdown-menu";
import { Settings } from "lucide-react";
import { useRef, type RefObject } from "react";
import type { TalkConversation } from "../talk/useTalkConversation";
import type { AgentComposerCommands } from "./commands";

/**
 * The menu behind the composer's mode icon: the workbench's search, the agent's modes (or the
 * voice conversation's controls, during one), and its settings. It lists the same commands that
 * the agent registers for the palette.
 */
export function ModeMenu({
  commands,
  talk,
  hasFile,
  inputRef,
  searchCommand,
}: {
  commands: AgentComposerCommands;
  talk: TalkConversation;
  hasFile: boolean;
  /** The prompt, which takes the focus after a mode is selected. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  searchCommand: Command;
}) {
  const { configuration } = commands;

  // Where the focus moves once the menu closes: the prompt (after selecting a mode), nowhere
  // (after opening a dialog or the search, which take it), or else back to the menu's trigger.
  const finalFocus = useRef<HTMLElement | boolean>(true);

  const menuItem = (command: Command) => (
    <CommandDropdownItem
      key={command.id}
      command={command}
      onClick={() => {
        finalFocus.current = false;
        // (So the focus returns to the prompt, not the menu item that's about to unmount)
        inputRef.current?.focus();
      }}
    />
  );

  return (
    <DropdownMenuContent
      align="start"
      className="mb-1"
      finalFocus={() => {
        const target = finalFocus.current;
        finalFocus.current = true;
        return target;
      }}
    >
      {menuItem(searchCommand)}
      <DropdownMenuSeparator />
      {talk.isActive ? (
        <>
          <CommandDropdownItem command={commands.voice.mute} />
          <CommandDropdownItem command={commands.voice.end} />
        </>
      ) : (
        <>
          {commands.modes.map((command, index) => {
            if (!command) return <DropdownMenuSeparator key={index} />;
            return (
              <CommandDropdownItem
                key={command.id}
                command={command}
                className={command.checked ? "bg-primary text-primary-foreground" : ""}
                onClick={() => {
                  finalFocus.current = inputRef.current ?? true;
                }}
              />
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Settings /> Configure
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {menuItem(configuration.global)}
              {hasFile && menuItem(configuration.file)}
              <DropdownMenuSeparator />
              {menuItem(configuration.models)}
              {menuItem(configuration.style)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      )}
    </DropdownMenuContent>
  );
}
