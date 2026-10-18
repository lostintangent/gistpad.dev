import { timeAgo } from "@/shared/dates";
import { CompletionList, useCompletions } from "@/shared/CompletionList";
import { Textarea } from "@/shared/ui/textarea";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { Globe } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { CustomCommand } from "./commands";

// Commands can reference gists (`@[Gist]`) and files in the open gist (`#[File]`), which are
// highlighted by an overlay (since the textarea's own text is transparent), and edited as a unit.

const REFERENCE_PATTERN = /([@#])\[([^\]]+)]/g;

const findReferences = (text: string) =>
  [...text.matchAll(REFERENCE_PATTERN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    symbol: match[1],
    name: match[2],
  }));

/** The command's text, with its references highlighted (where their brackets are invisible). */
function HighlightedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let index = 0;

  for (const { start, end, symbol, name } of findReferences(text)) {
    parts.push(text.slice(index, start));
    parts.push(
      <span key={start} className="text-blue-100 bg-blue-700 rounded">
        {symbol}
        <span className="invisible">[</span>
        {name}
        <span className="invisible">]</span>
      </span>,
    );
    index = end;
  }

  parts.push(text.slice(index));
  return parts;
}

/** The completion for the text before the cursor (i.e. a slash command, or a gist/file reference). */
function getCompletion(textBeforeCursor: string, allowCommands: boolean) {
  const command = allowCommands ? textBeforeCursor.match(/^\/(\S*)$/) : null;
  if (command) return { type: "command", query: command[1] };

  const reference = textBeforeCursor.match(/(?:^|\s)([@#])([^\s[\]]*)$/);
  return reference && { type: reference[1] === "@" ? "gist" : "file", query: reference[2] };
}

function CommandName({ command, query }: { command: CustomCommand; query: string }) {
  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-1 font-medium">
        <span>
          /<span className="text-blue-500">{command.name.slice(0, query.length)}</span>
          {command.name.slice(query.length)}
        </span>
        {command.isGlobal && <Globe className="h-3 w-3 text-muted-foreground" />}
      </span>
      <span className="text-xs text-muted-foreground">{command.description}</span>
    </span>
  );
}

export function CommandInput({
  value,
  onValueChange,
  onSubmit,
  previousCommand,
  commands,
  gists,
  files,
  placeholder,
  disabled,
  ref,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  /** The last command that was run (which can be recalled with the up arrow). */
  previousCommand: string;
  commands: CustomCommand[];
  gists: Gist[];
  files: string[];
  placeholder: string;
  disabled: boolean;
  ref: RefObject<HTMLTextAreaElement | null>;
}) {
  const highlightRef = useRef<HTMLDivElement>(null);

  // The cursor position (for the text it was measured in). And when the text is changed
  // by the parent (e.g. it's cleared), the cursor is at the end, like the browser places it.
  const [caret, setCaret] = useState({ text: "", position: 0 });
  const cursor = caret.text === value ? caret.position : value.length;

  const updateText = (textarea: HTMLTextAreaElement) => {
    onValueChange(textarea.value);
    setCaret({ text: textarea.value, position: textarea.selectionStart });
  };

  // Completions can be dismissed, until the text changes.
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  const completion =
    value === dismissedText ? null : getCompletion(value.slice(0, cursor), commands.length > 0);

  /** Replaces the text that's being completed (including its trigger character). */
  const insertCompletion = (text: string) => {
    const textarea = ref.current;
    if (!textarea || !completion) return;

    textarea.setRangeText(text, cursor - completion.query.length - 1, cursor, "end");
    updateText(textarea);
  };

  const query = completion?.query.toLowerCase() ?? "";
  const items: { key: string; content: ReactNode; select: () => void }[] =
    completion?.type === "command"
      ? commands
          .filter(({ name }) => name.toLowerCase().startsWith(query))
          .map((command) => ({
            key: command.name,
            content: <CommandName command={command} query={query} />,
            select: () => onValueChange(`/${command.name} `),
          }))
      : completion?.type === "gist"
        ? gists
            .filter((gist) => getGistDisplayName(gist).toLowerCase().includes(query))
            .toSorted((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
            .map((gist) => ({
              key: gist.id,
              content: (
                <span className="flex items-center gap-1 w-full overflow-hidden">
                  <span className="truncate flex-1">{getGistDisplayName(gist)}</span>
                  <span className="text-xs text-muted-foreground pl-2 whitespace-nowrap">
                    {timeAgo(gist.updated_at)}
                  </span>
                </span>
              ),
              select: () => insertCompletion(`@[${getGistDisplayName(gist)}] `),
            }))
        : completion?.type === "file"
          ? files
              .filter((file) => file.toLowerCase().includes(query))
              .map((file) => ({
                key: file,
                content: <span>{file}</span>,
                select: () => insertCompletion(`#[${file}] `),
              }))
          : [];

  const completions = useCompletions({
    items,
    onSelect: (item) => item.select(),
    onDismiss: () => setDismissedText(value),
  });

  /** Moves the cursor over references (or deletes them) as a unit. */
  const handleReferenceKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const position = textarea.selectionStart;
    if (position !== textarea.selectionEnd) return false;

    const isForward = event.key === "ArrowRight" || event.key === "Delete";
    const isBackward = event.key === "ArrowLeft" || event.key === "Backspace";
    const reference = findReferences(value).find(({ start, end }) =>
      isForward ? start === position : isBackward && end === position,
    );
    if (!reference) return false;

    event.preventDefault();
    if (event.key === "ArrowRight") {
      textarea.setSelectionRange(reference.end, reference.end);
    } else if (event.key === "ArrowLeft") {
      textarea.setSelectionRange(reference.start, reference.start);
    } else {
      textarea.setRangeText("", reference.start, reference.end, "start");
      updateText(textarea);
    }
    return true;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (completions.handleKeyDown(event) || handleReferenceKeys(event)) return;

    if (event.key === "ArrowUp" && !value.trim() && previousCommand) {
      event.preventDefault();
      onValueChange(previousCommand);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onValueChange("");
    }
  };

  return (
    <div className="relative flex-1">
      <CompletionList
        {...completions.listProps}
        getKey={(item) => item.key}
        className="bottom-full mb-2"
      >
        {(item) => item.content}
      </CompletionList>
      <div
        ref={highlightRef}
        className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-sm px-2 py-1 overflow-hidden"
        aria-hidden
      >
        <HighlightedText text={value} />
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          updateText(e.target);
          completions.reset();
        }}
        onSelect={(e) =>
          setCaret({ text: e.currentTarget.value, position: e.currentTarget.selectionStart })
        }
        onKeyDown={handleKeyDown}
        onScroll={(e) => {
          if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        // The text is transparent, so that the highlighted text (behind it) shows through.
        className="relative w-full resize-none min-h-0 max-h-[calc(3lh+0.5rem)] bg-transparent! border-none shadow-none focus-visible:ring-0 text-sm md:text-sm px-2 py-1 text-transparent caret-foreground"
      />
    </div>
  );
}
