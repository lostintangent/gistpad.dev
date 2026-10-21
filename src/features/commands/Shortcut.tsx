import { Kbd } from "@/shared/ui/kbd";
import { useIsMobile } from "@/shared/useMediaQuery";
import { formatForDisplay, type HotkeyChord } from "@tanstack/react-hotkeys";

/** A shortcut's keys (e.g. ⌘ S on a Mac, or Ctrl S elsewhere), as a row of key caps (where there's a keyboard). */
export function Shortcut({ shortcut }: { shortcut: HotkeyChord }) {
  const isMobile = useIsMobile();
  if (isMobile) return null;

  return (
    <span className="ml-auto flex shrink-0 gap-0.5">
      {formatForDisplay(shortcut, { parts: true }).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}
