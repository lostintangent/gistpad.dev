import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import type { Command } from "./command";
import { executeCommand, useCommand } from "./registry";
import { Shortcut } from "./Shortcut";

export function CommandDropdownItem({
  command: reference,
  variant,
  className,
  onClick,
}: {
  command: Command | string;
  variant?: "default" | "destructive";
  className?: string;
  onClick?: () => void;
}) {
  const command = useCommand(reference);
  if (!command) return null;
  const Icon = command.icon;
  return (
    <DropdownMenuItem
      variant={variant}
      className={className}
      disabled={command.disabled}
      onClick={() => {
        onClick?.();
        void executeCommand(reference);
      }}
    >
      {Icon && <Icon />}
      {command.title}
      {command.shortcut && <Shortcut shortcut={command.shortcut} />}
    </DropdownMenuItem>
  );
}
