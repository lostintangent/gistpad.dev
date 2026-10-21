import { useCompletions } from "@/shared/CompletionList";
import { ScrollableText } from "@/shared/ScrollableText";
import { Kbd } from "@/shared/ui/kbd";
import { useIsMobile } from "@/shared/useMediaQuery";
import type { ActionBarSurface } from "@/features/workbench/action-bar/ActionBarView";
import { cn } from "cn";
import { Check, ChevronLeft, CornerDownLeft, Loader2, Search } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { matchCommands, searchCommands, type CommandPage, type SearchMatch } from "./palette";
import { executeCommand, useRegisteredCommands } from "./registry";
import { Shortcut } from "./Shortcut";

const isPage = (match: SearchMatch): match is CommandPage => "commands" in match;

/**
 * The action bar's surface for searching: the registered commands that match a query (or those on
 * a page that one of them opened), docked above the query. Selecting a command runs it and closes
 * the search, while Escape and clicking away are the bar's to handle.
 */
export function CommandPalette({
  pages,
  onClose,
  children,
}: {
  pages: readonly CommandPage[];
  onClose: () => void;
  children: (surface: ActionBarSurface) => ReactNode;
}) {
  const commands = useRegisteredCommands();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [pageId, setPageId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const page = pages.find((page) => page.id === pageId);
  const matches = page
    ? matchCommands(page.commands, query)
    : searchCommands(commands, pages, query);
  const selectable = matches.filter((match) => isPage(match) || !match.disabled);

  const showPage = (id: string | null) => {
    setPageId(id);
    setQuery("");
    navigation.reset();
  };

  const select = (match: SearchMatch) => {
    if (isPage(match)) return showPage(match.id);

    void executeCommand(match);
    onClose();
  };

  const navigation = useCompletions({ items: selectable, onSelect: select, onDismiss: onClose });
  const highlighted = selectable[navigation.listProps.highlightedIndex];
  const optionId = (match: SearchMatch) =>
    `${listId}-${isPage(match) ? "page" : "command"}-${encodeURIComponent(match.id)}`;

  // Opening a page loads its commands (e.g. a file's revisions), and the input takes the focus
  // (when the palette opens, and back from the leading control)
  const loadPage = useEffectEvent(() => page?.load?.());
  useEffect(() => {
    loadPage();
    inputRef.current?.focus();
  }, [page?.id]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.key === "Tab") return;

    // (Backspacing past the query backs out of the page, or the search)
    if (event.key === "Backspace" && !query) {
      event.preventDefault();
      return page ? showPage(null) : onClose();
    }

    navigation.handleKeyDown(event);
  };

  const row = (match: SearchMatch) => {
    const command = isPage(match) ? null : match;
    const isHighlighted = match === highlighted;
    const { icon: Icon } = match;

    return (
      <button
        id={optionId(match)}
        key={optionId(match)}
        type="button"
        role="option"
        tabIndex={-1}
        aria-selected={isHighlighted}
        disabled={command?.disabled}
        ref={isHighlighted ? (element) => element?.scrollIntoView({ block: "nearest" }) : undefined}
        onMouseMove={() => {
          if (!command?.disabled) navigation.listProps.onHighlight(selectable.indexOf(match));
        }}
        onClick={() => select(match)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm disabled:opacity-50",
          isHighlighted && "bg-accent/50 text-accent-foreground",
        )}
      >
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate">{match.title}</span>
        {command?.detail && (
          <ScrollableText className="w-auto max-w-[50%] text-xs text-muted-foreground">
            {command.detail}
          </ScrollableText>
        )}
        {command?.checked && <Check className="size-4 shrink-0" />}
        {command?.shortcut && <Shortcut shortcut={command.shortcut} />}
      </button>
    );
  };

  return children({
    panel: (
      <div
        className="flex flex-col border-b animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
        // (Clicking a match keeps the focus in the input)
        onMouseDown={(event) => event.preventDefault()}
      >
        <div
          id={listId}
          role="listbox"
          aria-label={page?.title ?? "Commands"}
          className="max-h-[45vh] overflow-y-auto p-1.5"
        >
          {page?.isLoading ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" /> Loading {page.title.toLowerCase()}
            </div>
          ) : (
            matches.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                Nothing matches
              </div>
            )
          )}
          {[...Map.groupBy(matches, (match) => match.group)].map(([group, entries]) => (
            <section key={group ?? "page"} className="not-first:mt-1.5">
              {group && (
                <h3 className="px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </h3>
              )}
              {entries.map(row)}
            </section>
          ))}
        </div>
        {/* (The key hints are for keyboards) */}
        {!isMobile && (
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="size-3" />
              </Kbd>{" "}
              select
            </span>
            {!query && (
              <span className="flex items-center gap-1">
                <Kbd>⌫</Kbd> {page ? "back" : "close"}
              </span>
            )}
          </div>
        )}
      </div>
    ),
    leading: page
      ? { icon: <ChevronLeft />, label: "Back to commands", onClick: () => showPage(null) }
      : { icon: <Search />, label: "Close search", onClick: onClose },
    input: (
      <input
        data-slot="action-bar-input"
        ref={inputRef}
        role="combobox"
        aria-label="Search gists and commands"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={highlighted && optionId(highlighted)}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          navigation.reset();
        }}
        onKeyDown={onKeyDown}
        placeholder={page ? `Search ${page.title.toLowerCase()}` : "Search gists, or run a command"}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    ),
    hint: isMobile ? undefined : <Kbd>esc</Kbd>,
  });
}
