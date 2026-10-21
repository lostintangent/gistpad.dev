import type { Command } from "@/features/commands/command";
import { useCommands } from "@/features/commands/registry";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSelector } from "@tanstack/react-store";
import { Newspaper, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { dashboardOpenAtom, mobilePanelAtom, sidebarCollapsedAtom, zenModeAtom } from "./state";

export function useIsDashboardOpen() {
  const isMobile = useIsMobile();
  const desktop = useSelector(dashboardOpenAtom);
  const mobile = useSelector(mobilePanelAtom, (panel) => panel === "dashboard");
  const setIsOpen = (open: boolean) =>
    isMobile ? mobilePanelAtom.set(open ? "dashboard" : null) : dashboardOpenAtom.set(open);
  return [isMobile ? mobile : desktop, setIsOpen] as const;
}

export function useSidebarCommand(): Command {
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);
  const isCollapsed = useSelector(sidebarCollapsedAtom);
  return {
    id: "view.sidebar",
    title: isCollapsed ? "Expand sidebar" : "Collapse sidebar",
    group: "View",
    icon: isCollapsed ? PanelLeftOpen : PanelLeftClose,
    checked: !isCollapsed,
    disabled: isMobile || isZenMode,
    agent: "Show or hide the sidebar (the gist list).",
    run: () => sidebarCollapsedAtom.set(!sidebarCollapsedAtom.get()),
  };
}

export function useDashboardCommand(): Command {
  const [isOpen, setIsOpen] = useIsDashboardOpen();
  const isZenMode = useSelector(zenModeAtom);
  return {
    id: "view.dashboard",
    title: isOpen ? "Close dashboard" : "Open dashboard",
    group: "View",
    icon: Newspaper,
    checked: isOpen,
    disabled: isZenMode,
    agent: "Show or hide the dashboard (widgets such as the weather and news).",
    run: () => setIsOpen(!isOpen),
  };
}

export function useLayoutCommands() {
  const sidebar = useSidebarCommand();
  const dashboard = useDashboardCommand();
  useCommands([sidebar, dashboard]);
}
