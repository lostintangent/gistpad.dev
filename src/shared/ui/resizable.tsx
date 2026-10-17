import { cn } from "cn";
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

/**
 * A resize handle reads as a one pixel rule, with a wider (invisible) hit area. It's exported so
 * that other resizable edges (that can't be a `ResizableHandle`) can look like one.
 */
export const RESIZE_HANDLE_RULE =
  "relative w-px after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function ResizableHandle({
  withHandle,
  gap,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
  /** Whether the handle sits in a gutter between cards (where its rule only shows while it's used) */
  gap?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        RESIZE_HANDLE_RULE,
        "flex items-center justify-center bg-border focus-visible:ring-offset-1 aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:-translate-y-1/2 aria-[orientation=horizontal]:after:translate-x-0 [&[aria-orientation=horizontal]>div]:rotate-90",
        // (The accent runs along the handle, so horizontal handles, in a vertical group, run across)
        "data-[separator=hover]:bg-[image:var(--resize-accent-y)]",
        "data-[separator=active]:bg-[image:var(--resize-accent-y)]",
        "aria-[orientation=horizontal]:data-[separator=hover]:bg-[image:var(--resize-accent-x)]",
        "aria-[orientation=horizontal]:data-[separator=active]:bg-[image:var(--resize-accent-x)]",
        gap && "bg-transparent",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
