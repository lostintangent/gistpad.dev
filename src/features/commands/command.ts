import type { HotkeyChord } from "@tanstack/react-hotkeys";
import type { LucideIcon } from "lucide-react";

/** An executable feature operation, independent of the UI that discovers or invokes it. */
export interface Command {
  id: string;
  title: string;
  group?: string;
  detail?: string;
  icon?: LucideIcon;
  shortcut?: HotkeyChord;
  checked?: boolean;
  disabled?: boolean;
  /** Accepts text supplied by a caller; without it, the command gathers input or uses its defaults. */
  acceptsInput?: boolean;
  /** Discoverable by search, but omitted from the palette's initial suggestions. */
  searchOnly?: boolean;
  /**
   * What the command does, for the agent, which can then run it for the user (as the palette would).
   * Describe both directions of a toggle ("Show or hide…"), since its state (`checked`) is reported
   * with it. Say when not to run it, where that matters. Omit it to keep the command out of the
   * agent's reach.
   */
  agent?: string;
  run: (input?: string) => unknown;
}
