import { RESIZE_HANDLE_RULE } from "@/shared/ui/resizable";
import { cn } from "cn";
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { RAIL_WIDTH, SIDEBAR_BORDER } from "./Sidebar";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, clampSidebarWidth } from "./store";

/** How far one arrow key nudges the sidebar's edge. */
const KEYBOARD_STEP = 16;

type SidebarDrag = { isCollapsed: true } | { isCollapsed: false; width: number };

/**
 * Reads a dragged edge as a layout: past halfway between the rail and the narrowest sidebar, the
 * drag is asking to collapse, and anything wider is a width to keep.
 */
function resolveSidebarDrag(width: number): SidebarDrag {
  if (width < (RAIL_WIDTH + SIDEBAR_MIN_WIDTH) / 2) return { isCollapsed: true };
  return { isCollapsed: false, width: clampSidebarWidth(Math.round(width)) };
}

/**
 * Sizes the (desktop) sidebar, which can be dragged wider or narrower (or into its rail) by its
 * edge. It holds a fixed pixel width, so the workspace's panes divide whatever's left (as
 * percentages), which is why it's a plain element rather than a `ResizablePanel`.
 *
 * The drag lives here, so following the pointer only re-renders this wrapper. The sidebar arrives
 * as an element, and learns the width of its expanded layout through `--sidebar-width`.
 */
export function SidebarResizer({
  width,
  isCollapsed,
  isHidden,
  onWidthChange,
  onCollapsedChange,
  children,
}: {
  /** The width of the expanded sidebar (including its border), which is kept while it's collapsed. */
  width: number;
  isCollapsed: boolean;
  /** Hides the sidebar (e.g. in zen mode), without forgetting its width. */
  isHidden: boolean;
  onWidthChange: (width: number) => void;
  onCollapsedChange: (isCollapsed: boolean) => void;
  children: ReactNode;
}) {
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const isDragging = dragWidth !== null;
  const currentWidth = isCollapsed ? RAIL_WIDTH : (dragWidth ?? width);

  const applyDrag = (edge: number) => {
    const drag = resolveSidebarDrag(edge);
    if (drag.isCollapsed !== isCollapsed) onCollapsedChange(drag.isCollapsed);
    if (!drag.isCollapsed) setDragWidth(drag.width);
  };

  const commitDrag = () => {
    // A drag that ended on the rail asked to collapse (not to resize), so the sidebar keeps the
    // width that it'll expand back to
    if (dragWidth !== null && !isCollapsed) onWidthChange(dragWidth);
    setDragWidth(null);
  };

  const nudge = (edge: number) => {
    const drag = resolveSidebarDrag(edge);
    if (drag.isCollapsed !== isCollapsed) onCollapsedChange(drag.isCollapsed);
    if (!drag.isCollapsed) onWidthChange(drag.width);
  };

  // The expanded layout holds its width while it fades out, so the narrowing sidebar clips its
  // content (rather than squeezing it). Only a drag that's resizing it needs it to track the edge.
  const style: CSSProperties & { "--sidebar-width": string } = {
    width: isHidden ? 0 : currentWidth,
    "--sidebar-width": isDragging && !isCollapsed ? "100%" : `${width - SIDEBAR_BORDER}px`,
  };

  return (
    <>
      <div
        style={style}
        className={cn(
          "shrink-0 overflow-hidden",
          !isDragging && "transition-[width,opacity] duration-200 ease-in-out",
          isHidden && "opacity-0",
        )}
      >
        {children}
      </div>

      <SidebarEdge
        width={currentWidth}
        isHidden={isHidden}
        isDisabled={isCollapsed && !isDragging}
        isDragging={isDragging}
        onDragStart={() => setDragWidth(currentWidth)}
        onDrag={applyDrag}
        onDragEnd={commitDrag}
        onNudge={nudge}
      />
    </>
  );
}

/**
 * The sidebar's edge, which (like the resize handles between cards) is an invisible rule down the
 * middle of the gutter, until it's hovered or dragged. While the sidebar is collapsed, it still
 * holds the gutter open, but can't be dragged (since the rail is expanded by its toggle).
 */
function SidebarEdge({
  width,
  isHidden,
  isDisabled,
  isDragging,
  onDragStart,
  onDrag,
  onDragEnd,
  onNudge,
}: {
  width: number;
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
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
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
        if (origin) onDrag(origin.width + (event.clientX - origin.pointer));
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
        onNudge(width + step);
      }}
      className={cn(
        RESIZE_HANDLE_RULE,
        // (Centered in the gutter between the sidebar and the workspace)
        "z-10 mx-1 shrink-0 cursor-col-resize touch-none select-none after:w-1.5",
        "hover:bg-[image:var(--resize-accent-y)]",
        isDragging && "bg-[image:var(--resize-accent-y)]",
        isHidden && "hidden",
      )}
    />
  );
}
