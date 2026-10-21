import { RESIZE_HANDLE_RULE } from "@/shared/ui/resizable";
import { cn } from "cn";
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

// The panels beside the workspace (the sidebar and the dashboard) are recessed into the
// backdrop. On desktop, they're resizable (and collapsible), and on mobile, they slide in.

/** How far one arrow key nudges a panel's edge. */
const KEYBOARD_STEP = 16;

type PanelDrag = { isCollapsed: true } | { isCollapsed: false; width: number };

/**
 * A desktop panel with fixed pixel width and its own resize/collapse behavior. The workspace's panes
 * divide whatever space remains as percentages.
 *
 * The drag lives here, so following the pointer only re-renders this wrapper (and not the panel's
 * content, which arrives as an element).
 */
export function SidePanel({
  side,
  label,
  width,
  limits,
  collapsedWidth,
  isCollapsed,
  isHidden,
  onWidthChange,
  onCollapsedChange,
  children,
}: {
  /** The side of the workspace that the panel is on (and so, which way its edge is dragged). */
  side: "left" | "right";
  /** The edge's accessible label (e.g. "Resize sidebar"). */
  label: string;
  /** The width of the expanded panel, which is kept while it's collapsed. */
  width: number;
  limits: { min: number; max: number };
  /** The width that the panel collapses to (e.g. the sidebar's rail, or 0, which closes it). */
  collapsedWidth: number;
  isCollapsed: boolean;
  /** Hides the panel (e.g. in zen mode), without forgetting its width. */
  isHidden: boolean;
  onWidthChange: (width: number) => void;
  onCollapsedChange: (isCollapsed: boolean) => void;
  children: ReactNode;
}) {
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const originRef = useRef<{ pointer: number; width: number } | null>(null);
  const direction = side === "left" ? 1 : -1;
  const isDragging = dragWidth !== null;
  const currentWidth = isCollapsed ? collapsedWidth : (dragWidth ?? width);

  // Past halfway between the collapsed width and the narrowest panel, a drag is asking to collapse,
  // and anything wider is a width to keep
  const resolveDrag = (edge: number): PanelDrag =>
    edge < (collapsedWidth + limits.min) / 2
      ? { isCollapsed: true }
      : { isCollapsed: false, width: Math.min(limits.max, Math.max(limits.min, Math.round(edge))) };

  const applyDrag = (edge: number) => {
    const drag = resolveDrag(edge);
    if (drag.isCollapsed !== isCollapsed) onCollapsedChange(drag.isCollapsed);
    if (!drag.isCollapsed) setDragWidth(drag.width);
  };

  const commitDrag = () => {
    // A drag that ended collapsed asked to collapse (not to resize), so the panel keeps the width
    // that it'll expand back to
    if (dragWidth !== null && !isCollapsed) onWidthChange(dragWidth);
    setDragWidth(null);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!originRef.current) return;
    originRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    commitDrag();
  };

  const nudge = (edge: number) => {
    const drag = resolveDrag(edge);
    if (drag.isCollapsed !== isCollapsed) onCollapsedChange(drag.isCollapsed);
    if (!drag.isCollapsed) onWidthChange(drag.width);
  };

  // The content holds its (expanded) width, and is anchored to the window's edge, so the panel clips
  // it as it narrows (rather than squeezing it). Only a drag that's resizing it needs it to track.
  const style = {
    "--panel-size": `${isHidden ? 0 : currentWidth}px`,
    "--panel-width": isDragging && !isCollapsed ? "100%" : `${width}px`,
  } as CSSProperties;

  const panel = (
    <div
      style={style}
      className={cn(
        // (Clipped rather than hidden, so that it isn't a scroll container, which `scrollIntoView()`
        // would scroll when revealing a gist in the collapsed sidebar's hidden layout)
        "workbench-panel relative shrink-0 overflow-clip",
        !isDragging && "transition-[width,opacity] duration-200 ease-in-out",
        isHidden && "opacity-0",
      )}
    >
      <div
        className={cn(
          "workbench-panel-content absolute inset-y-0 flex flex-col",
          side === "left" ? "left-0" : "right-0",
        )}
      >
        {children}
      </div>
    </div>
  );

  const edge = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={currentWidth}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      tabIndex={0}
      inert={isCollapsed && !isDragging}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        originRef.current = { pointer: event.clientX, width: currentWidth };
        setDragWidth(currentWidth);
      }}
      onPointerMove={(event) => {
        const origin = originRef.current;
        if (origin) applyDrag(origin.width + direction * (event.clientX - origin.pointer));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowLeft"
            ? -KEYBOARD_STEP
            : event.key === "ArrowRight"
              ? KEYBOARD_STEP
              : 0;
        if (step === 0) return;
        event.preventDefault();
        nudge(currentWidth + direction * step);
      }}
      className={cn(
        RESIZE_HANDLE_RULE,
        // (Centered in the narrow gutter between the panel's padding and the workspace)
        "z-10 mx-0.5 shrink-0 cursor-col-resize touch-none select-none after:w-1.5",
        "hover:bg-[image:var(--resize-accent-y)]",
        isDragging && "bg-[image:var(--resize-accent-y)]",
        isHidden ? "hidden" : "hidden md:block",
      )}
    />
  );

  // The edge is always between the panel and the workspace
  return side === "left" ? (
    <>
      {panel}
      {edge}
    </>
  ) : (
    <>
      {edge}
      {panel}
    </>
  );
}
