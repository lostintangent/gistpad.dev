import { RESIZE_HANDLE_RULE } from "@/shared/ui/resizable";
import { cn } from "cn";
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

// The panels beside the workspace (the sidebar and the dashboard) are recessed into the
// backdrop. On desktop, they're resizable (and collapsible), and on mobile, they slide in.

/** How far one arrow key nudges a panel's edge. */
const KEYBOARD_STEP = 16;

type PanelDrag = { isCollapsed: true } | { isCollapsed: false; width: number };

/**
 * A (desktop) panel beside the workspace, which can be dragged wider or narrower by its edge (or past
 * its narrowest width, to collapse it). It holds a fixed pixel width, so the workspace's panes divide
 * whatever's left (as percentages), which is why it's a plain element rather than a `ResizablePanel`.
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

  const nudge = (edge: number) => {
    const drag = resolveDrag(edge);
    if (drag.isCollapsed !== isCollapsed) onCollapsedChange(drag.isCollapsed);
    if (!drag.isCollapsed) onWidthChange(drag.width);
  };

  // The content holds its (expanded) width, and is anchored to the window's edge, so the panel clips
  // it as it narrows (rather than squeezing it). Only a drag that's resizing it needs it to track.
  const style: CSSProperties & { "--panel-width": string } = {
    width: isHidden ? 0 : currentWidth,
    "--panel-width": isDragging && !isCollapsed ? "100%" : `${width}px`,
  };

  const panel = (
    <div
      style={style}
      className={cn(
        // (Clipped rather than hidden, so that it isn't a scroll container, which `scrollIntoView()`
        // would scroll when revealing a gist in the collapsed sidebar's hidden layout)
        "relative shrink-0 overflow-clip",
        !isDragging && "transition-[width,opacity] duration-200 ease-in-out",
        isHidden && "opacity-0",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 flex flex-col w-(--panel-width)",
          side === "left" ? "left-0" : "right-0",
        )}
      >
        {children}
      </div>
    </div>
  );

  const edge = (
    <PanelEdge
      label={label}
      direction={side === "left" ? 1 : -1}
      width={currentWidth}
      limits={limits}
      isHidden={isHidden}
      isDisabled={isCollapsed && !isDragging}
      isDragging={isDragging}
      onDragStart={() => setDragWidth(currentWidth)}
      onDrag={applyDrag}
      onDragEnd={commitDrag}
      onNudge={nudge}
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

/**
 * A panel's edge, which (like the resize handles between cards) is an invisible rule beside the
 * workspace, until it's hovered or dragged. While the panel is collapsed, it can't be dragged
 * (since it's expanded by its toggle).
 */
function PanelEdge({
  label,
  direction,
  width,
  limits,
  isHidden,
  isDisabled,
  isDragging,
  onDragStart,
  onDrag,
  onDragEnd,
  onNudge,
}: {
  label: string;
  /** Whether dragging (or nudging) the edge rightward widens the panel (1) or narrows it (-1). */
  direction: 1 | -1;
  width: number;
  limits: { min: number; max: number };
  isHidden: boolean;
  isDisabled: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDrag: (edge: number) => void;
  onDragEnd: () => void;
  onNudge: (edge: number) => void;
}) {
  const originRef = useRef<{ pointer: number; width: number } | null>(null);

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!originRef.current) return;
    originRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onDragEnd();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      tabIndex={0}
      inert={isDisabled}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        originRef.current = { pointer: event.clientX, width };
        onDragStart();
      }}
      onPointerMove={(event) => {
        const origin = originRef.current;
        if (origin) onDrag(origin.width + direction * (event.clientX - origin.pointer));
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
        onNudge(width + direction * step);
      }}
      className={cn(
        RESIZE_HANDLE_RULE,
        // (Centered in the narrow gutter between the panel's padding and the workspace)
        "z-10 mx-0.5 shrink-0 cursor-col-resize touch-none select-none after:w-1.5",
        "hover:bg-[image:var(--resize-accent-y)]",
        isDragging && "bg-[image:var(--resize-accent-y)]",
        isHidden && "hidden",
      )}
    />
  );
}

/**
 * The panels on mobile, which are beside the workspace too (rather than over it, since they're
 * recessed): opening one slides the workspace aside, without squeezing it, and tapping the workspace
 * slides it back. (The page clips whatever's slid off the screen.)
 */
export function MobilePanels({
  openPanel,
  onClose,
  left,
  right,
  children,
}: {
  openPanel: "left" | "right" | null;
  onClose: () => void;
  left: ReactNode;
  right: ReactNode;
  children: ReactNode;
}) {
  // How far the panels (and the gutters between them and the workspace) are slid to the left
  const offset = { left: 0, workspace: 1, right: 2 }[openPanel ?? "workspace"];

  return (
    <div
      // (The panels are most of the screen's width, so that the workspace peeks out beside them)
      className="h-full flex gap-(--gutter) [--panel:85vw] [--gutter:--spacing(2)] transition-transform duration-300 ease-in-out"
      style={{ transform: `translateX(calc(${-offset} * (var(--panel) + var(--gutter))))` }}
    >
      <div inert={openPanel !== "left"} className="w-(--panel) shrink-0">
        {left}
      </div>
      <div className="relative w-full shrink-0">
        {children}
        {openPanel && (
          <button className="absolute inset-0 z-20" aria-label="Close panel" onClick={onClose} />
        )}
      </div>
      <div inert={openPanel !== "right"} className="w-(--panel) shrink-0">
        {right}
      </div>
    </div>
  );
}
