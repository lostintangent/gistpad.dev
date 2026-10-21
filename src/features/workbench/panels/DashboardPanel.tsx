import { CommandButton } from "@/features/commands/CommandButton";
import LoadingSkeleton from "@/shared/LoadingSkeleton";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { useRouter } from "@tanstack/react-router";
import { Check, Edit, Newspaper, PanelRightClose } from "lucide-react";
import { cn } from "cn";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSelector } from "@tanstack/react-store";
import { lazy, Suspense, useRef, useState } from "react";
import { SidePanel } from "../layout/SidePanel";
import { DASHBOARD_WIDTH, dashboardWidthAtom, zenModeAtom } from "../layout/state";
import { useIsDashboardOpen, useDashboardCommand } from "../layout/commands";

// The dashboard's widgets are loaded on demand (and preloaded when the user is about to open it)
const loadWidgetList = () => import("@/features/dashboard/WidgetList");
const WidgetList = lazy(loadWidgetList);

/** Opens (or closes) the dashboard. */
export function DashboardButton({ className }: { className?: string }) {
  const dashboard = useDashboardCommand();
  return (
    <CommandButton
      command={dashboard}
      variant="ghost"
      size="icon"
      className={className}
      onPointerEnter={loadWidgetList}
      onFocus={loadWidgetList}
    />
  );
}

/** The dashboard, which (like the sidebar) is a panel beside the workspace. */
export function DashboardPanel() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useIsDashboardOpen();
  const isZenMode = useSelector(zenModeAtom);
  const width = useSelector(dashboardWidthAtom);

  const isShell = useRouter().isShell();
  const [isEditMode, setIsEditMode] = useState(false);
  const widgetListRef = useRef<HTMLDivElement>(null);
  if (!isOpen && isEditMode) setIsEditMode(false);

  const dashboard = (
    <div className="h-full flex flex-col" inert={!isOpen && !isShell}>
      <div className="px-2 pt-3 pb-2 flex-none">
        <div className="flex items-center justify-between">
          <h2
            className="font-semibold cursor-pointer flex items-center gap-2"
            onClick={() =>
              widgetListRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
            }
          >
            <Newspaper className="size-4" />
            Dashboard
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                isEditMode && "hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20",
              )}
              title={isEditMode ? "Save and exit edit mode" : "Edit widgets"}
            >
              {isEditMode ? <Check /> : <Edit />}
            </Button>
            <Separator
              orientation="vertical"
              className="h-4 data-vertical:self-center bg-separator"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              title="Close dashboard"
              onClick={() => setIsOpen(false)}
            >
              <PanelRightClose />
            </Button>
          </div>
        </div>
      </div>
      {isShell ? (
        <LoadingSkeleton />
      ) : (
        isOpen && (
          <Suspense fallback={<LoadingSkeleton />}>
            <WidgetList
              ref={widgetListRef}
              isEditMode={isEditMode}
              onEditModeChange={setIsEditMode}
            />
          </Suspense>
        )
      )}
    </div>
  );

  // (On mobile, the workbench slides it in)
  if (isMobile) return dashboard;

  return (
    <SidePanel
      side="right"
      label="Resize dashboard"
      width={width}
      limits={DASHBOARD_WIDTH}
      // (Dragging the dashboard narrower than it can be closes it)
      collapsedWidth={0}
      isCollapsed={!isOpen}
      isHidden={!isShell && (!isOpen || isZenMode)}
      onWidthChange={(width) => dashboardWidthAtom.set(width)}
      onCollapsedChange={(collapsed) => setIsOpen(!collapsed)}
    >
      {dashboard}
    </SidePanel>
  );
}
