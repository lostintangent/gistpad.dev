import { cn } from "cn";
import { useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Keyboard navigation for a list of completions, which is displayed for the text that's
 * being typed into an input (and so the input keeps focus while the list is open).
 */
export function useCompletions<T>({
  items,
  onSelect,
  onDismiss,
}: {
  items: T[];
  onSelect: (item: T) => void;
  onDismiss: () => void;
}) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const index = Math.min(highlightedIndex, items.length - 1);

  return {
    /** Highlights the first completion (e.g. when the text being completed changes). */
    reset: () => setHighlightedIndex(0),

    /** Handles the keys that navigate the list, and returns whether the key was handled. */
    handleKeyDown: (event: KeyboardEvent) => {
      if (items.length === 0) return false;

      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp": {
          event.preventDefault();
          const offset = event.key === "ArrowDown" ? 1 : -1;
          setHighlightedIndex((index + offset + items.length) % items.length);
          return true;
        }
        case "Enter":
        case "Tab":
          event.preventDefault();
          onSelect(items[index]);
          return true;
        case "Escape":
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
          return true;
        default:
          return false;
      }
    },

    listProps: { items, highlightedIndex: index, onHighlight: setHighlightedIndex, onSelect },
  };
}

export function CompletionList<T>({
  items,
  getKey,
  highlightedIndex,
  onHighlight,
  onSelect,
  className,
  children: renderItem,
}: {
  items: T[];
  getKey: (item: T) => string;
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (item: T) => void;
  className?: string;
  children: (item: T) => ReactNode;
}) {
  if (items.length === 0) return null;

  return (
    <div
      role="listbox"
      className={cn(
        "absolute left-0 z-50 w-full max-h-[300px] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={getKey(item)}
          ref={
            index === highlightedIndex
              ? (element) => element?.scrollIntoView({ block: "nearest" })
              : undefined
          }
          type="button"
          role="option"
          aria-selected={index === highlightedIndex}
          // Keep focus in the input that's being completed
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(item)}
          onMouseEnter={() => onHighlight(index)}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
            index === highlightedIndex && "bg-accent text-accent-foreground",
          )}
        >
          {renderItem(item)}
        </button>
      ))}
    </div>
  );
}
