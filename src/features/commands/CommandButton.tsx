import { Button } from "@/shared/ui/button";
import type { ComponentProps } from "react";
import type { Command } from "./command";
import { executeCommand, useCommand } from "./registry";

export function CommandButton({
  command: reference,
  size = "default",
  children,
  ...props
}: {
  command: Command | string;
} & Omit<
  ComponentProps<typeof Button>,
  "onClick" | "disabled" | "title" | "aria-label" | "aria-pressed"
>) {
  const command = useCommand(reference);
  if (!command) return null;
  const Icon = command.icon;

  return (
    <Button
      {...props}
      size={size}
      title={command.title}
      aria-label={command.title}
      aria-pressed={command.checked}
      disabled={command.disabled}
      onClick={() => void executeCommand(reference)}
    >
      {children ?? (Icon && <Icon />)}
      {!size?.startsWith("icon") && command.title}
    </Button>
  );
}
