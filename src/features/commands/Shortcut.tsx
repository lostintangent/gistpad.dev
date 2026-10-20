import { Kbd } from "@/shared/ui/kbd";
import { formatForDisplay, type HotkeyChord } from "@tanstack/react-hotkeys";

/** A shortcut's keys (e.g. ⌘ S on a Mac, or Ctrl S elsewhere), as a row of key caps. */
export function Shortcut({ shortcut }: { shortcut: HotkeyChord }) {
  return (
    <span className="ml-auto flex shrink-0 gap-0.5">
      {formatForDisplay(shortcut, { parts: true }).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}
