import { Button } from "@/shared/ui/button";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSelector } from "@tanstack/react-store";
import { Newspaper } from "lucide-react";
import { lazy, Suspense } from "react";
import { SidePanel } from "./SidePanel";
import {
  DASHBOARD_WIDTH,
  dashboardOpenAtom,
  dashboardWidthAtom,
  mobilePanelAtom,
  zenModeAtom,
} from "./layout";

// The dashboard's widgets are loaded on demand (and preloaded when the user is about to open it)
const loadWidgetList = () => import("@/features/dashboard/WidgetList");
const WidgetList = lazy(loadWidgetList);

/** Whether the dashboard is open, which is remembered on desktop (but not on mobile). */
function useIsDashboardOpen() {
  const isMobile = useIsMobile();
  const isOpenOnDesktop = useSelector(dashboardOpenAtom);
  const isOpenOnMobile = useSelector(mobilePanelAtom, (panel) => panel === "dashboard");

  const setIsOpen = (isOpen: boolean) =>
    isMobile ? mobilePanelAtom.set(isOpen ? "dashboard" : null) : dashboardOpenAtom.set(isOpen);

  return [isMobile ? isOpenOnMobile : isOpenOnDesktop, setIsOpen] as const;
}

/** Opens (or closes) the dashboard. */
export function DashboardButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useIsDashboardOpen();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-pressed={isOpen}
      title={isOpen ? "Close dashboard" : "Open dashboard"}
      onClick={() => setIsOpen(!isOpen)}
      onPointerEnter={loadWidgetList}
      onFocus={loadWidgetList}
    >
      <Newspaper />
    </Button>
  );
}

/** The dashboard, which (like the sidebar) is a panel beside the workspace. */
export function Dashboard() {
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
