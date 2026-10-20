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
  run: (input?: string) => unknown;
}
