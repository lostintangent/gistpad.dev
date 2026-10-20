import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { cn } from "cn";
import type { ReactNode } from "react";

/** A control at either end of the bar's row: a button, or (with `menu`) the trigger of a menu. */
export interface ActionBarControl {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** The menu that the control opens (a `DropdownMenuContent`). */
  menu?: ReactNode;
}

/**
 * One of the action bar's surfaces (the command palette, or the agent's composer): a row (a
 * leading control, its input, and a trailing control or hint), and a panel docked above the row.
 * The bar renders it in a fixed geometry, so the controls and the input's inset don't move
 * between surfaces.
 */
export interface ActionBarSurface {
  panel?: ReactNode;
  leading: ActionBarControl;
  input: ReactNode;
  trailing?: ActionBarControl;
  /** A hint after the input (e.g. the key that closes the palette). */
  hint?: ReactNode;
  /** Whether the row is as wide as the workspace (e.g. for a long answer). */
  isExpanded?: boolean;
  /** Whether the feature is working (which the bar glows for). */
  isBusy?: boolean;
}

function Control({ icon, label, onClick, disabled, menu }: ActionBarControl) {
  const props = {
    variant: "ghost",
    size: "icon-sm",
    "aria-label": label,
    title: label,
    disabled,
    onClick,
    className: "self-end rounded-lg hover:bg-muted hover:text-popover-foreground",
  } as const;

  if (!menu) return <Button {...props}>{icon}</Button>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button {...props} />}>{icon}</DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}

/** Renders a surface in the action bar's geometry. */
export function ActionBarView({ surface }: { surface: ActionBarSurface }) {
  return (
    <>
      {surface.panel}
      <div
        data-slot="action-bar-row"
        className={cn(
          "flex p-1",
          "[&_[data-slot=action-bar-input]]:min-h-8 [&_[data-slot=action-bar-input]]:px-2 [&_[data-slot=action-bar-input]]:py-1.5 [&_[data-slot=action-bar-input]]:text-sm",
          "[&_textarea:placeholder-shown]:overflow-hidden [&_textarea:placeholder-shown]:whitespace-nowrap",
        )}
      >
        <Control {...surface.leading} />
        {surface.input}
        {surface.trailing && <Control {...surface.trailing} />}
        {surface.hint && <span className="mx-1 self-center">{surface.hint}</span>}
      </div>
    </>
  );
}
