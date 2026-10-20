import { useIsAgentEnabled } from "@/features/agent/settings/modelSettings";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { CommandShortcuts } from "@/features/commands/CommandShortcuts";
import type { Command } from "@/features/commands/command";
import type { CommandPage } from "@/features/commands/palette";
import { useCommands } from "@/features/commands/registry";
import { Shortcut } from "@/features/commands/Shortcut";
import { cn } from "cn";
import { Search } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { ActionBarView, type ActionBarSurface } from "./ActionBarView";

// The agent is only loaded for users who've configured it
const AgentComposer = lazy(() => import("@/features/agent/composer/AgentComposer"));

/**
 * The card that floats over the workspace, which shows one of two surfaces: the command palette
 * (while searching), or the agent's composer. Otherwise it's a search box. The bar owns the card,
 * the search session (opened with Mod+K, and dismissed with Escape or by clicking away), and
 * giving the focus back afterwards.
 */
export function ActionBar({
  hasFile,
  isAgentVisible,
  isAgentAvailable,
  showEdits,
  pages,
}: {
  hasFile: boolean;
  /** Whether the composer has room (e.g. it gives way to the comments, on mobile). */
  isAgentVisible: boolean;
  /** Whether the agent can act on the file (e.g. not while a revision is viewed). */
  isAgentAvailable: boolean;
  showEdits: boolean;
  /** The pages of commands that the palette can open (e.g. a file's revisions). */
  pages: readonly CommandPage[];
}) {
  const isAgentEnabled = useIsAgentEnabled();
  const [isSearching, setIsSearching] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openSearch = () => {
    if (document.activeElement instanceof HTMLElement) returnFocus.current = document.activeElement;
    setIsSearching(true);
  };

  // What had the focus gets it back, unless something else has taken it by the time the search is
  // gone (e.g. what was clicked, or a dialog that a command opened)
  const closeSearch = () => {
    setIsSearching(false);
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) returnFocus.current?.focus();
    });
  };

  const searchCommand: Command = {
    id: "workbench.search",
    title: "Search",
    group: "View",
    icon: Search,
    shortcut: "Mod+K",
    searchOnly: true,
    run: () => (isSearching ? closeSearch() : openSearch()),
  };
  useCommands([searchCommand]);

  const searchBox: ActionBarSurface = {
    leading: { icon: <Search />, label: "Search", onClick: openSearch },
    input: (
      <button
        type="button"
        data-slot="action-bar-input"
        onClick={openSearch}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-muted-foreground outline-none"
      >
        <span className="min-w-0 flex-1 truncate">Search gists or run a command</span>
        <Shortcut shortcut="Mod+K" />
      </button>
    ),
  };

  const card = (agent?: ActionBarSurface) => {
    const showAgent = !!agent && isAgentVisible && !isSearching;
    const hasPanel = showAgent && !!agent.panel;
    const isCentered = !hasFile && !hasPanel;
    const isBusy = !!agent?.isBusy;

    return (
      <div
        className={cn(
          "absolute left-1/2 z-50 w-[85%] -translate-x-1/2 transition-all ease-in-out duration-300",
          !(showAgent && agent.isExpanded) && "max-w-[470px]",
          isCentered ? "bottom-1/2 translate-y-5" : "bottom-5",
        )}
      >
        <div
          className={cn(
            "flex flex-col rounded-xl border bg-popover text-popover-foreground transition-shadow duration-300",
            hasPanel || isSearching || isCentered
              ? "shadow-2xl dark:shadow-accent-glow"
              : "shadow-lg",
            isBusy
              ? "shadow-accent-glow"
              : "focus-within:shadow-2xl dark:focus-within:shadow-accent-glow has-[[data-popup-open]]:shadow-2xl dark:has-[[data-popup-open]]:shadow-accent-glow",
          )}
          onKeyDown={(event) => {
            if (!isSearching || event.key !== "Escape") return;
            event.preventDefault();
            closeSearch();
          }}
          onBlur={(event) => {
            if (isSearching && !event.currentTarget.contains(event.relatedTarget)) closeSearch();
          }}
        >
          {isSearching && (
            <CommandPalette pages={pages} onClose={closeSearch}>
              {(surface) => <ActionBarView surface={surface} />}
            </CommandPalette>
          )}
          {/* (The composer is hidden rather than unmounted, so its prompt and voice session are kept) */}
          {agent && (
            <div hidden={!showAgent}>
              <ActionBarView surface={agent} />
            </div>
          )}
          {!isSearching && !showAgent && <ActionBarView surface={searchBox} />}
        </div>
      </div>
    );
  };

  return (
    <>
      <CommandShortcuts />
      {isAgentEnabled ? (
        <Suspense fallback={card()}>
          <AgentComposer
            isAvailable={isAgentAvailable}
            showEdits={showEdits}
            searchCommand={searchCommand}
          >
            {card}
          </AgentComposer>
        </Suspense>
      ) : (
        card()
      )}
    </>
  );
}
