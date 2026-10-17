import { CountBadge } from "@/shared/ui/count-badge";
import { EmojiInput } from "@/shared/EmojiInput";
import TagBadge from "./TagBadge";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/shared/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useCreateAndOpenGist, useOpenTodaysNote } from "./actions";
import { useGists } from "./queries";
import { usePreferences } from "@/features/account/queries";
import { queryClient } from "@/shared/query-client";
import { Toggle } from "@base-ui/react/toggle";
import { cn } from "cn";
import {
  ArrowUp,
  Calendar,
  ChevronDown,
  Globe,
  Plus,
  RefreshCw,
  Tag as TagIcon,
} from "lucide-react";
import { useRef, useState } from "react";

const LONG_PRESS_DURATION = 300;

// In the sidebar's rail, the menu is a tab that's revealed beneath the button (while it's hovered,
// focused or open), rather than taking up room in the rail.
const RAIL_MENU_CLASSES =
  "absolute left-0 top-full h-3 w-6 rounded-t-none border-t border-background pointer-events-none opacity-0 transition-opacity group-hover/create:pointer-events-auto group-hover/create:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 data-popup-open:pointer-events-auto data-popup-open:opacity-100";

function CreateGistForm({ onCreated }: { onCreated: () => void }) {
  const { tags } = usePreferences();
  const createGist = useCreateAndOpenGist();

  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createGist({ description: description.replace(/\s+/g, " ").trim(), isPublic, tagIds });
        onCreated();
      }}
    >
      <InputGroup className="bg-popover shadow-md dark:bg-popover">
        <EmojiInput
          placeholder="New gist title..."
          value={description}
          onValueChange={setDescription}
          multiline
          // (The composer is at the top of the screen, so there's room for completions below it)
          completionsSide="bottom"
          autoFocus
          // (Titles are a single line, so enter creates the gist, rather than adding a line)
          onEnter={(e) => {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }}
        />
        <InputGroupAddon align="block-end">
          <Toggle
            pressed={isPublic}
            onPressedChange={setIsPublic}
            render={<InputGroupButton size="icon-xs" className="aria-pressed:bg-accent/50" />}
            aria-label="Public"
            title={isPublic ? "Public" : "Private"}
          >
            <Globe />
          </Toggle>
          {Object.keys(tags).length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <InputGroupButton
                    size="icon-xs"
                    className={`relative${tagIds.length > 0 ? " bg-accent/50" : ""}`}
                    aria-label="Tags"
                  />
                }
              >
                <TagIcon />
                <CountBadge count={tagIds.length} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-45">
                {Object.entries(tags).map(([id, tag]) => (
                  <DropdownMenuCheckboxItem
                    key={id}
                    checked={tagIds.includes(id)}
                    onCheckedChange={(checked) =>
                      setTagIds((ids) => (checked ? [...ids, id] : ids.filter((t) => t !== id)))
                    }
                    closeOnClick={false}
                  >
                    <TagBadge tag={tag.name} color={tag.color} />
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-xs"
            className="ml-auto rounded-md"
            aria-label="Create gist"
          >
            <ArrowUp />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

/**
 * A split button for creating a new gist (which opens a composer for its title and settings beside
 * it), whose menu opens today's note or refreshes the gist list. And when it's long-pressed, it
 * immediately creates an untitled gist.
 */
export default function CreateGistButton({ isRail = false }: { isRail?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const createGist = useCreateAndOpenGist();
  const openTodaysNote = useOpenTodaysNote();
  const { isFetching } = useGists();
  const groupRef = useRef<HTMLDivElement>(null);

  const longPressTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wasLongPressed = useRef(false);

  const cancelLongPress = () => clearTimeout(longPressTimeout.current);

  // The composer and menu open toward the editor: beside the rail, or below the sidebar's header
  const side = isRail ? "right" : "bottom";
  const align = isRail ? "start" : "end";

  return (
    <div ref={groupRef} className={cn("flex", isRail && "group/create relative")}>
      <Popover
        open={isOpen}
        onOpenChange={(open, { reason, event }) => {
          // Pressing escape in the tags menu closes the menu, but not the composer that it's within
          const isClosingMenu =
            reason === "escape-key" && (event.target as Element).closest("[role=menu]");
          if (!open && isClosingMenu) return;

          // (The click that ends a long press shouldn't also open the composer)
          if (open && wasLongPressed.current) wasLongPressed.current = false;
          else setIsOpen(open);
        }}
      >
        <PopoverTrigger
          render={
            <Button
              variant="accent"
              size="icon-sm"
              className={cn(
                "select-none",
                isRail
                  ? "size-6 group-hover/create:rounded-b-none group-has-data-popup-open/create:rounded-b-none"
                  : // (Matching the height of the sidebar header's filter input)
                    "size-8 rounded-r-none",
              )}
              title="Create new gist"
            />
          }
          onPointerDown={() => {
            wasLongPressed.current = false;
            longPressTimeout.current = setTimeout(() => {
              wasLongPressed.current = true;
              createGist({});
            }, LONG_PRESS_DURATION);
          }}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
        >
          <Plus />
        </PopoverTrigger>
        {/* The composer is the popover's (visible) surface, which is aligned with the whole button */}
        <PopoverContent
          anchor={groupRef}
          side={side}
          align={align}
          className="w-80 p-0 border-0 bg-transparent shadow-none"
        >
          <CreateGistForm onCreated={() => setIsOpen(false)} />
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="accent"
              size="icon-sm"
              className={
                isRail ? RAIL_MENU_CLASSES : "h-8 w-4 rounded-l-none border-l border-background"
              }
              aria-label="More"
            />
          }
        >
          <ChevronDown className={isRail ? "size-2.5" : "size-3"} />
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={align}>
          <DropdownMenuItem onClick={openTodaysNote}>
            <Calendar /> Open today's note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: ["gists"] })}
          >
            <RefreshCw className={isFetching ? "animate-spin" : ""} /> Refresh gists
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
