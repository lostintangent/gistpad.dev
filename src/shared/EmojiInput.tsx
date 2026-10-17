import { CompletionList, useCompletions } from "@/shared/CompletionList";
import { InputGroupInput, InputGroupTextarea } from "@/shared/ui/input-group";
import { emojisQuery, type Emoji } from "@/shared/emojis";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ComponentProps, type KeyboardEvent, type Ref } from "react";

/*
 * An input (or textarea) that autocompletes emoji shortcodes (e.g. typing `:tada`). It's the
 * control of an `InputGroup` (which positions its completions), so that composers can embed their
 * controls alongside it (e.g. a submit button).
 */

type InputElement = HTMLInputElement | HTMLTextAreaElement;

const MAX_MATCHES = 50;

/** The shortcode being typed at the cursor (i.e. the text after a `:` that starts a word). */
function getShortcodeQuery(element: InputElement) {
  const textBeforeCursor = element.value.slice(0, element.selectionStart ?? element.value.length);
  return textBeforeCursor.match(/(?:^|\s):([^\s:]*)$/)?.[1] ?? null;
}

/** Emojis that match a query, with exact matches first, followed by prefix matches. */
function findEmojis(emojis: Emoji[], query: string) {
  const rank = ({ id }: Emoji) =>
    id === query ? 0 : id.startsWith(query) ? 1 : id.includes(query) ? 2 : 3;

  return emojis
    .filter(
      ({ id, keywords }) => !query || id.includes(query) || keywords.some((k) => k.includes(query)),
    )
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_MATCHES);
}

interface EmojiInputProps extends Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "ref" | "type"
> {
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  /** Where the emoji completions appear (by default, above textareas and below inputs). */
  completionsSide?: "top" | "bottom";
  onEnter?: (event: KeyboardEvent<InputElement>) => void;
  onEscape?: (event: KeyboardEvent<InputElement>) => void;
  ref?: Ref<InputElement>;
}

export function EmojiInput({
  value,
  onValueChange,
  multiline = false,
  completionsSide = multiline ? "top" : "bottom",
  onEnter,
  onEscape,
  ref,
  ...props
}: EmojiInputProps) {
  const inputRef = useRef<InputElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);

  const { data: emojis = [] } = useQuery({ ...emojisQuery, enabled: query !== null });
  const matches = query === null ? [] : findEmojis(emojis, query.toLowerCase());

  const completions = useCompletions({
    items: matches,
    onSelect: (emoji) => {
      const element = inputRef.current;
      if (!element || query === null) return;

      // Replace the shortcode (and its leading `:`) with the emoji
      const cursor = element.selectionStart ?? element.value.length;
      element.setRangeText(`${emoji.native} `, cursor - query.length - 1, cursor, "end");
      onValueChange(element.value);
      setQuery(null);
    },
    onDismiss: () => setQuery(null),
  });

  const inputProps = {
    ...props,
    value,
    ref: (element: InputElement | null) => {
      inputRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    onChange: (event: React.ChangeEvent<InputElement>) => {
      onValueChange(event.target.value);
      setQuery(getShortcodeQuery(event.target));
      completions.reset();
    },
    onKeyDown: (event: KeyboardEvent<InputElement>) => {
      if (completions.handleKeyDown(event)) return;
      if (event.key === "Enter") onEnter?.(event);
      if (event.key === "Escape") onEscape?.(event);
    },
  };

  return (
    <>
      {multiline ? (
        <InputGroupTextarea {...(inputProps as ComponentProps<typeof InputGroupTextarea>)} />
      ) : (
        <InputGroupInput {...(inputProps as ComponentProps<typeof InputGroupInput>)} />
      )}
      <CompletionList
        {...completions.listProps}
        getKey={(emoji) => emoji.id}
        className={completionsSide === "top" ? "bottom-full mb-1" : "top-full mt-1"}
      >
        {(emoji) => (
          <>
            <span className="text-lg min-w-[24px]">{emoji.native}</span>
            <span className="text-muted-foreground">:{emoji.id}:</span>
          </>
        )}
      </CompletionList>
    </>
  );
}
