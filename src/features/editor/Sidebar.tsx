import CreateGistButton from "@/features/gists/CreateGistButton";
import GistList from "@/features/gists/list/GistList";
import ResearchStatus from "@/features/agent/research/ResearchStatus";
import { UserMenu } from "@/features/account/UserMenu";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DashboardButton } from "./Dashboard";
import { SidePanel } from "./SidePanel";
import { SIDEBAR_WIDTH, sidebarCollapsedAtom, sidebarWidthAtom, zenModeAtom } from "./layout";

/** The size of the sidebar's actions, which the rail is one of across. */
const ACTION_SIZE = "size-6";

/** The width of the collapsed rail (one action between two insets). */
const RAIL_WIDTH = 40;

/** An action-sized space, which an action that's pinned over both of the sidebar's layouts fills. */
const ActionSpacer = ({ className }: { className?: string }) => (
  <div className={cn("shrink-0", ACTION_SIZE, className)} aria-hidden />
);

/** The rail's separators are the footer's (vertical) separator, turned on its side. */
const RAIL_SEPARATOR = "my-1.5 data-horizontal:w-4 bg-separator";

/**
 * Crossfades one of the sidebar's layouts (expanded, or the collapsed rail). The leaving layout
 * clears out quickly, so its content is never squeezed as the sidebar narrows, and the arriving
 * layout fades in as the width settles.
 */
const layerClass = (isVisible: boolean) =>
  cn(
    "transition-opacity ease-out motion-reduce:transition-none",
    isVisible ? "opacity-100 delay-150 duration-200" : "pointer-events-none opacity-0 duration-100",
  );

function SidebarFooter({ leadingSlot }: { leadingSlot: ReactNode }) {
  return (
    // (Its actions line up with the gist list's "..." buttons, and its sections' counts)
    <div className="pl-2 pr-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {leadingSlot}
        <Separator
          orientation="vertical"
          className="data-vertical:h-4 data-vertical:self-center mx-1 bg-separator"
        />
        <span className="font-semibold">GistPad</span>
      </div>
      <div className="flex items-center gap-3">
        <ResearchStatus className={ACTION_SIZE} />
        <DashboardButton className={ACTION_SIZE} />
      </div>
    </div>
  );
}

/**
 * The collapsed sidebar: its header and footer, turned on their side, so the gist list gives up its
 * room without taking the sidebar's actions with it. The collapse toggle and avatar are pinned over
 * both layouts, so this stack leaves a space for each of them.
 */
function SidebarRail({ isVisible }: { isVisible: boolean }) {
  return (
    <div
      inert={!isVisible}
      style={{ width: RAIL_WIDTH }}
      className={cn(
        "absolute inset-y-0 left-0 flex flex-col items-center gap-3 py-3",
        layerClass(isVisible),
      )}
    >
      {/* The collapse toggle is centered in the header's (taller) row, which leaves it a step lower */}
      <ActionSpacer className="mt-1" />
      <Separator className={RAIL_SEPARATOR} />
      <CreateGistButton isRail />
      <div className="flex-1" />
      <ResearchStatus className={ACTION_SIZE} />
      <DashboardButton className={ACTION_SIZE} />
      <Separator className={RAIL_SEPARATOR} />
      <ActionSpacer />
    </div>
  );
}

/** The sidebar's layout where it can't collapse (on mobile, or in zen mode's hover sheet). */
function ExpandedLayout() {
  return (
    <div className="h-full flex flex-col">
      <GistList />
      <SidebarFooter leadingSlot={<UserMenu side="top" />} />
    </div>
  );
}

/**
 * The sidebar's layout on desktop, which can collapse into a rail (that keeps the actions from its
 * header and footer). The collapse toggle and avatar are pinned over both layouts (which crossfade),
 * so that they don't move when it collapses or expands.
 */
function CollapsibleLayout({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <div className="relative h-full">
      {/* (Centered in the header's row, which is as tall as its filter input) */}
      <div className="absolute top-3 left-2 z-10 flex h-8 items-center">
        <Button
          variant="ghost"
          size="icon"
          className={ACTION_SIZE}
          onClick={() => sidebarCollapsedAtom.set(!isCollapsed)}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <div
        inert={isCollapsed}
        className={cn("absolute inset-0 flex flex-col", layerClass(!isCollapsed))}
      >
        <GistList leadingSlot={<ActionSpacer />} />
        <SidebarFooter leadingSlot={<ActionSpacer />} />
      </div>

      <SidebarRail isVisible={isCollapsed} />

      <div className="absolute bottom-3 left-2 z-10 flex">
        <UserMenu side={isCollapsed ? "right" : "top"} />
      </div>
    </div>
  );
}

/** In zen mode, the sidebar is hidden, but it can be revealed by hovering over the window's left edge. */
function HoverSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const width = useSelector(sidebarWidthAtom);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (event.clientX <= 30) setIsOpen(true);
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="gap-0 p-0 bg-backdrop data-[side=left]:border-r-0 data-[side=left]:sm:max-w-none"
        style={{ width }}
        onPointerLeave={() => setIsOpen(false)}
      >
        <ExpandedLayout />
      </SheetContent>
    </Sheet>
  );
}

/**
 * The gist list, between a header (for filtering and creating gists) and a footer (for the user's
 * account and the dashboard), which is a panel beside the workspace.
 */
export function Sidebar() {
  const isMobile = useIsMobile();
  const isZenMode = useSelector(zenModeAtom);
  const isCollapsed = useSelector(sidebarCollapsedAtom);
  const width = useSelector(sidebarWidthAtom);

  // (On mobile, `MobilePanels` slides it in)
  if (isMobile) return <ExpandedLayout />;

  return (
    <>
      {isZenMode && <HoverSheet />}
      <SidePanel
        side="left"
        label="Resize sidebar"
        width={width}
        limits={SIDEBAR_WIDTH}
        collapsedWidth={RAIL_WIDTH}
        isCollapsed={isCollapsed}
        isHidden={isZenMode}
        onWidthChange={(width) => sidebarWidthAtom.set(width)}
        onCollapsedChange={(isCollapsed) => sidebarCollapsedAtom.set(isCollapsed)}
      >
        <CollapsibleLayout isCollapsed={isCollapsed} />
      </SidePanel>
    </>
  );
}
