import iconUrl from "@/assets/icon.png";
import scratchUrl from "@/assets/scratch.svg";
import CreateGistButton from "@/features/gists/CreateGistButton";
import ResearchStatus from "@/features/ai/research/ResearchStatus";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/shared/ui/sheet";
import { UserMenu } from "@/features/session/UserMenu";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useSession } from "@/features/session/queries";
import { draftAtom } from "./store";
import { mobileSidebarOpenAtom, sidebarCollapsedAtom, zenModeAtom } from "./store";
import { useAtom, useSelector } from "@tanstack/react-store";
import { EyeOff, Newspaper, PanelLeftOpen } from "lucide-react";
import { lazy, Suspense } from "react";

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

export function AppHeader({ isGistListVisible }: { isGistListVisible: boolean }) {
  const { user } = useSession();
  const isMobile = useIsMobile();
  const [isZenMode, setIsZenMode] = useAtom(zenModeAtom);
  const hasUnsavedChanges = useSelector(draftAtom, (draft) => draft !== null);

  const showSidebarButton = !isZenMode && !isGistListVisible;

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <img src={user?.login === "lostintangent1" ? scratchUrl : iconUrl} className="w-7" />
          GistPad
          {!isMobile && !isZenMode && (
            <span className="ml-2 px-2 py-0 border border-gray-400 text-gray-400 text-xs font-medium rounded-full flex items-center">
              Experimental
            </span>
          )}
        </h1>
        {showSidebarButton && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Show gists"
            onClick={() =>
              isMobile ? mobileSidebarOpenAtom.set(true) : sidebarCollapsedAtom.set(false)
            }
          >
            <PanelLeftOpen />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <ResearchStatus />
        {isZenMode ? (
          <div className="flex items-center">
            {hasUnsavedChanges && <span className="bg-blue-500 w-2 h-2 rounded-full mr-2" />}
            <Button variant="outline" size="sm" onClick={() => setIsZenMode(false)}>
              <EyeOff />
              Exit zen mode
            </Button>
          </div>
        ) : (
          <>
            <NewsDashboard />
            <CreateGistButton />
            <UserMenu />
          </>
        )}
      </div>
    </header>
  );
}
