import CreateGistButton from "@/features/gists/CreateGistButton";
import GistList from "@/features/gists/list/GistList";
import ResearchStatus from "@/features/ai/research/ResearchStatus";
import { UserMenu } from "@/features/account/UserMenu";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/shared/ui/sheet";
import { cn } from "cn";
import { Newspaper, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { CARD_CLASS } from "./card";

/** The sidebar is a card, whose border is included in its width. */
export const SIDEBAR_BORDER = 2;

/** The size of the sidebar's actions, which the rail is one of across. */
const ACTION_SIZE = "size-6";

/** The width of the collapsed rail (one action between two insets). */
export const RAIL_WIDTH = 44 + SIDEBAR_BORDER;

// The news dashboard is loaded on demand (and preloaded when the user is about to open it)
const loadWidgetDashboard = () => import("@/features/dashboard/WidgetDashboard");
const WidgetDashboard = lazy(loadWidgetDashboard);

function NewsDashboard() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className={ACTION_SIZE} title="Open news dashboard" />
        }
        onPointerEnter={loadWidgetDashboard}
        onFocus={loadWidgetDashboard}
      >
        <Newspaper />
      </SheetTrigger>
      <SheetContent
        showCloseButton={false}
        className="w-[100vw] md:w-[400px] flex flex-col gap-0 border-l-0 md:border-l md:border-l-border"
      >
        <Suspense>
          <WidgetDashboard />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}

/** An action-sized space, which an action that's pinned over both of the sidebar's layouts fills. */
const ActionSpacer = ({ className }: { className?: string }) => (
  <div className={cn("shrink-0", ACTION_SIZE, className)} aria-hidden />
);

/** The rail's separators are the footer's (vertical) separator, turned on its side. */
const RAIL_SEPARATOR = "my-1.5 data-horizontal:w-4 bg-muted-foreground/50";

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
    <div className="border-t px-2.5 py-3 bg-muted/30 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {leadingSlot}
        <Separator
          orientation="vertical"
          className="data-vertical:h-4 data-vertical:self-center mx-1 bg-muted-foreground/50"
        />
        <span className="font-semibold">GistPad</span>
      </div>
      <div className="flex items-center gap-3">
        <ResearchStatus className={ACTION_SIZE} />
        <NewsDashboard />
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
      style={{ width: RAIL_WIDTH - SIDEBAR_BORDER }}
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
      <NewsDashboard />
      <Separator className={RAIL_SEPARATOR} />
      <ActionSpacer />
    </div>
  );
}

/**
 * The gist list, between a header (for filtering and creating gists) and a footer (for the user's
 * account and the news dashboard). On desktop, it can collapse into a rail, which keeps the actions
 * from its header and footer. The collapse toggle and avatar are pinned over both of its layouts
 * (which crossfade), so that they don't move when it collapses or expands.
 */
export function Sidebar({
  isCollapsed = false,
  onCollapsedChange,
}: {
  isCollapsed?: boolean;
  /** Makes the sidebar collapsible (on desktop). */
  onCollapsedChange?: (isCollapsed: boolean) => void;
}) {
  if (!onCollapsedChange) {
    return (
      <div className={cn(CARD_CLASS, "h-full flex flex-col")}>
        <GistList />
        <SidebarFooter leadingSlot={<UserMenu side="top" />} />
      </div>
    );
  }

  return (
    <div className={cn(CARD_CLASS, "relative h-full")}>
      {/* (Centered in the header's row, which is as tall as its filter input) */}
      <div className="absolute top-3 left-2.5 z-10 flex h-8 items-center">
        <Button
          variant="ghost"
          size="icon"
          className={ACTION_SIZE}
          onClick={() => onCollapsedChange(!isCollapsed)}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      {/* The expanded layout keeps its width (from `SidebarResizer`), so its content doesn't squeeze while collapsing */}
      <div
        inert={isCollapsed}
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col w-[var(--sidebar-width,100%)]",
          layerClass(!isCollapsed),
        )}
      >
        <GistList leadingSlot={<ActionSpacer />} />
        <SidebarFooter leadingSlot={<ActionSpacer />} />
      </div>

      <SidebarRail isVisible={isCollapsed} />

      <div className="absolute bottom-3 left-2.5 z-10 flex">
        <UserMenu side={isCollapsed ? "right" : "top"} />
      </div>
    </div>
  );
}
