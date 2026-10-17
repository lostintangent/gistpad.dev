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

/** The widths of the expanded sidebar, and of its collapsed rail (on desktop). */
export const SIDEBAR_WIDTH = 325;
export const RAIL_WIDTH = 58;

/** The sidebar is a card, whose border is included in its width. */
const SIDEBAR_BORDER = 2;

// The news dashboard is loaded on demand (and preloaded when the user is about to open it)
const loadWidgetDashboard = () => import("@/features/dashboard/WidgetDashboard");
const WidgetDashboard = lazy(loadWidgetDashboard);

function NewsDashboard() {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-sm" title="Open news dashboard" />}
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

/** A button-sized space, which an action that's pinned over both of the sidebar's layouts fills. */
const ActionSpacer = () => <div className="size-8 shrink-0" aria-hidden />;

/** The rail's separators are the footer's (vertical) separator, turned on its side. */
const RAIL_SEPARATOR = "data-horizontal:w-4 bg-muted-foreground/50";

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
    <div className="border-t px-3 py-1.5 bg-muted/30 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {leadingSlot}
        <Separator
          orientation="vertical"
          className="data-vertical:h-4 data-vertical:self-center mx-1 bg-muted-foreground/50"
        />
        <span className="font-semibold">GistPad</span>
      </div>
      <div className="flex items-center gap-1">
        <ResearchStatus />
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
        "absolute inset-y-0 left-0 flex flex-col items-center gap-2 pt-3 pb-1.5",
        layerClass(isVisible),
      )}
    >
      <ActionSpacer />
      <Separator className={RAIL_SEPARATOR} />
      <CreateGistButton isRail />
      <div className="flex-1" />
      <ResearchStatus />
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
      <div className="absolute top-3 left-3 z-10">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onCollapsedChange(!isCollapsed)}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      {/* The expanded layout keeps its width, so its content doesn't squeeze while collapsing */}
      <div
        inert={isCollapsed}
        style={{ width: SIDEBAR_WIDTH - SIDEBAR_BORDER }}
        className={cn("absolute inset-y-0 left-0 flex flex-col", layerClass(!isCollapsed))}
      >
        <GistList leadingSlot={<ActionSpacer />} />
        <SidebarFooter leadingSlot={<ActionSpacer />} />
      </div>

      <SidebarRail isVisible={isCollapsed} />

      <div className="absolute bottom-1.5 left-3 z-10">
        <UserMenu side={isCollapsed ? "right" : "top"} />
      </div>
    </div>
  );
}
