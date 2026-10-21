import { createAtom, useSelector } from "@tanstack/react-store";
import { useId, useLayoutEffect } from "react";
import { toast } from "sonner";
import type { Command } from "./command";

// Features register their commands here (from the components that own the state the commands act
// on, for as long as those are mounted), and the palette, shortcuts, buttons and menus consume
// them: by reference, or by id (for a command that's registered elsewhere).

type Owner = string | symbol;

/** Each owner's commands, in the order the owners first registered (which they keep when they re-register). */
const registrationsAtom = createAtom<ReadonlyMap<Owner, readonly Command[]>>(new Map());

const commandsAtom = createAtom(() => [...registrationsAtom.get().values()].flat());

function setRegistration(owner: Owner, commands?: readonly Command[]) {
  const registrations = new Map(registrationsAtom.get());
  if (commands) registrations.set(owner, commands);
  else registrations.delete(owner);
  registrationsAtom.set(registrations);
}

/** Registers commands outside of React (e.g. in tests), until they're disposed. */
export function registerCommands(commands: readonly Command[]) {
  const owner = Symbol();
  setRegistration(owner, commands);

  return {
    update: (commands: readonly Command[]) => setRegistration(owner, commands),
    dispose: () => setRegistration(owner),
  };
}

/**
 * Registers a component's commands while it's mounted (before it paints, so that buttons which
 * look them up by id never flash absent).
 */
export function useCommands(commands: readonly Command[]) {
  const owner = useId();
  useLayoutEffect(() => setRegistration(owner, commands), [owner, commands]);
  useLayoutEffect(() => () => setRegistration(owner), [owner]);
}

/** The registered commands, or a selection of them (which only re-renders when the selection changes). */
export const useRegisteredCommands = <T = readonly Command[]>(
  select?: (commands: readonly Command[]) => T,
) => useSelector(commandsAtom, select);
export const getRegisteredCommands = () => commandsAtom.get();
export const findCommand = (id: string) => commandsAtom.get().find((command) => command.id === id);

/** A command by reference, or (for one that's registered elsewhere) by id, as it's currently registered. */
export function useCommand(reference: Command | string) {
  return useSelector(commandsAtom, (commands) =>
    typeof reference === "string" ? commands.find(({ id }) => id === reference) : reference,
  );
}

/**
 * Runs a command (by reference or id), unless it's disabled, and reports whether it succeeded.
 * Failures are shown to the user, so that every button, menu item, shortcut and palette row shares
 * the same boundary.
 */
export async function executeCommand(reference: Command | string, input?: string) {
  const command = typeof reference === "string" ? findCommand(reference) : reference;
  if (!command) throw new Error(`Command "${reference}" is not registered.`);
  if (command.disabled) return false;

  try {
    await command.run(input);
    return true;
  } catch (error) {
    console.error(`Failed to run command ${command.id}:`, error);
    toast.error(`Could not run "${command.title}".`);
    return false;
  }
}
