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
} from "./store";

// The news dashboard is loaded on demand (and preloaded when the user is about to open it)
const loadWidgetDashboard = () => import("@/features/dashboard/WidgetDashboard");
const WidgetDashboard = lazy(loadWidgetDashboard);

/** Whether the dashboard is open, which is remembered on desktop (but not on mobile). */
function useIsDashboardOpen() {
  const isMobile = useIsMobile();
  const isOpenOnDesktop = useSelector(dashboardOpenAtom);
  const isOpenOnMobile = useSelector(mobilePanelAtom, (panel) => panel === "dashboard");

  const setIsOpen = (isOpen: boolean) =>
    isMobile ? mobilePanelAtom.set(isOpen ? "dashboard" : null) : dashboardOpenAtom.set(isOpen);

  return [isMobile ? isOpenOnMobile : isOpenOnDesktop, setIsOpen] as const;
}

/** Opens (or closes) the news dashboard. */
export function NewsDashboardButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useIsDashboardOpen();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-pressed={isOpen}
      title={isOpen ? "Close news dashboard" : "Open news dashboard"}
      onClick={() => setIsOpen(!isOpen)}
      onPointerEnter={loadWidgetDashboard}
      onFocus={loadWidgetDashboard}
    >
      <Newspaper />
    </Button>
  );
}

/** The news dashboard, which (like the sidebar) is a panel beside the workspace. */
export function NewsDashboard() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useIsDashboardOpen();
  const isZenMode = useSelector(zenModeAtom);
  const width = useSelector(dashboardWidthAtom);

  const dashboard = (
    <Suspense>
      <WidgetDashboard onClose={() => setIsOpen(false)} />
    </Suspense>
  );

  // (On mobile, `MobilePanels` slides it in)
  if (isMobile) return <div className="h-full flex flex-col">{isOpen && dashboard}</div>;

  return (
    <SidePanel
      side="right"
      label="Resize news dashboard"
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
