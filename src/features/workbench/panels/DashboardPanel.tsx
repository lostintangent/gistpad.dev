import { CommandButton } from "@/features/commands/CommandButton";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSelector } from "@tanstack/react-store";
import { lazy, Suspense } from "react";
import { SidePanel } from "../layout/SidePanel";
import { DASHBOARD_WIDTH, dashboardWidthAtom, zenModeAtom } from "../layout/state";
import { useIsDashboardOpen } from "../layout/commands";

// The dashboard's widgets are loaded on demand (and preloaded when the user is about to open it)
const loadWidgetList = () => import("@/features/dashboard/WidgetList");
const WidgetList = lazy(loadWidgetList);

/** Opens (or closes) the dashboard. */
export function DashboardButton({ className }: { className?: string }) {
  return (
    <CommandButton
      command="view.dashboard"
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

  const dashboard = (
    <Suspense>
      <WidgetList onClose={() => setIsOpen(false)} />
    </Suspense>
  );

  // (On mobile, `MobilePanels` slides it in)
  if (isMobile) return <div className="h-full flex flex-col">{isOpen && dashboard}</div>;

  return (
    <SidePanel
      side="right"
      label="Resize dashboard"
      width={width}
      limits={DASHBOARD_WIDTH}
      // (Dragging the dashboard narrower than it can be closes it)
      collapsedWidth={0}
      isCollapsed={false}
      isHidden={!isOpen || isZenMode}
      onWidthChange={(width) => dashboardWidthAtom.set(width)}
      onCollapsedChange={() => setIsOpen(false)}
    >
      {isOpen && dashboard}
    </SidePanel>
  );
}
