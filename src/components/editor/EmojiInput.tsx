import emojiData from "@emoji-mart/data/sets/15/native.json";
import { useEffect, useRef, useState } from "react";
import { Command, CommandItem, CommandList } from "../ui/command";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

/* This is an input control that provides auto-completion for emojis,
and supports being rendered as either an input or a textarea. */

interface EmojiData {
    emojis: {
        [key: string]: {
            id: string;
            name: string;
            keywords: string[];
            skins: { unified: string; native: string }[];
            version: number;
        };
    };
}

const emojis = Object.entries((emojiData as EmojiData).emojis).map(([id, emoji]) => ({
    id,
    keywords: emoji.keywords || [],
    native: emoji.skins[0]?.native || "",
}));

type EmojiInputElement = HTMLInputElement | HTMLTextAreaElement;
type EmojiInputType = "input" | "textarea";

interface EmojiInputProps extends Omit<React.InputHTMLAttributes<EmojiInputElement>, "type"> {
    onValueChange?: (value: string) => void;
    type?: EmojiInputType;
    onEnter?: (e: React.KeyboardEvent<EmojiInputElement>) => void;
    onEscape?: (e: React.KeyboardEvent<EmojiInputElement>) => void;
    ref?: React.Ref<EmojiInputElement>;
}

export const EmojiInput = ({
    value,
    onChange,
    onValueChange,
    type = "input",
    onEnter,
    onEscape,
    ref,
    ...props
}: EmojiInputProps) => {
    const [showEmojiList, setShowEmojiList] = useState(false);
    const [emojiSearch, setEmojiSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [userSelectedIndex, setUserSelectedIndex] = useState<number | null>(null);

    const localInputRef = useRef<EmojiInputElement>(null);
    const inputRef = (ref || localInputRef) as React.RefObject<EmojiInputElement>;

    const currentValue = value as string;

    const handleInputChange = (e: React.ChangeEvent<EmojiInputElement>) => {
        const newValue = e.target.value;

        // Close list if colon was deleted
        const hadColon = currentValue?.includes(":");
        const hasColon = newValue.includes(":");
        if (hadColon && !hasColon) {
            setShowEmojiList(false);
            setUserSelectedIndex(null);
        }

        if (onChange) {
            onChange(e);
        }

        // Reset user selection when typing
        setUserSelectedIndex(null);
    };

    useEffect(() => {
        if (!currentValue) {
            setShowEmojiList(false);
            setUserSelectedIndex(null);
            return;
        }

        const element = inputRef.current;
        if (!element) {
            setShowEmojiList(false);
            setUserSelectedIndex(null);
            return;
        }

        const cursorIndex = element.selectionStart ?? currentValue.length;
        const textBeforeCursor = currentValue.slice(0, cursorIndex);
        const colonIndex = textBeforeCursor.lastIndexOf(":");

        if (colonIndex === -1) {
            setShowEmojiList(false);
            setUserSelectedIndex(null);
            return;
        }

        // Check if colon is at start or preceded by space
        const beforeColon = colonIndex > 0 ? textBeforeCursor[colonIndex - 1] : " ";
        if (beforeColon !== " ") {
            setShowEmojiList(false);
            setUserSelectedIndex(null);
            return;
        }

        const afterColon = textBeforeCursor.slice(colonIndex + 1);
        if (afterColon.includes(" ")) {
            setShowEmojiList(false);
            setUserSelectedIndex(null);
            return;
        }

        setEmojiSearch(afterColon);
        setShowEmojiList(true);
    }, [currentValue]);

    const filteredEmojis = emojis
        .filter(
            (emoji) =>
                !emojiSearch ||
                emoji.id.includes(emojiSearch.toLowerCase()) ||
                emoji.keywords.some((keyword) => keyword.includes(emojiSearch.toLowerCase()))
        ).sort((a, b) => {
            const aId = a.id.toLowerCase();
            const bId = b.id.toLowerCase();
            const query = emojiSearch.toLowerCase();

            const aExactMatch = aId === query;
            const bExactMatch = bId === query;
            const aStartsWithQuery = aId.startsWith(query);
            const bStartsWithQuery = bId.startsWith(query);
            const aIncludesQuery = aId.includes(query);
            const bIncludesQuery = bId.includes(query);

            // First priority: exact match (e.g. ":heart:" > ":heart_eyes:" when typing "heart") 
            if (aExactMatch && !bExactMatch) return -1;
            if (!aExactMatch && bExactMatch) return 1;

            // Second priority: starts with query (e.g. ":lock:" vs. ":clock:" when typing "lock")
            if (aStartsWithQuery && !bStartsWithQuery) return -1;
            if (!aStartsWithQuery && bStartsWithQuery) return 1;

            // Third priority: includes query (e.g. ":word_map:" vs. ":pushpin:" when typing "map")
            if (aIncludesQuery && !bIncludesQuery) return -1;
            if (!aIncludesQuery && bIncludesQuery) return 1;

            // Maintain original order
            return 0;
        }).slice(0, 50);

    // Reset userSelectedIndex if it's out of bounds of the filtered results
    useEffect(() => {
        if (userSelectedIndex !== null && userSelectedIndex >= filteredEmojis.length) {
            setUserSelectedIndex(null);
        }
    }, [filteredEmojis.length, userSelectedIndex]);

    // Use user selection if available and valid, otherwise use first item
    useEffect(() => {
        setSelectedIndex(
            userSelectedIndex !== null && userSelectedIndex < filteredEmojis.length
                ? userSelectedIndex
                : 0
        );
    }, [userSelectedIndex, filteredEmojis]);

    const handleSelectEmoji = (emoji: typeof emojis[0]) => {
        const element = inputRef.current;
        if (!element) return;

        const cursorIndex = element.selectionStart ?? currentValue.length;
        const textBeforeCursor = currentValue.slice(0, cursorIndex);
        const colonIndex = textBeforeCursor.lastIndexOf(":");
        if (colonIndex === -1) return;

        const before = currentValue.slice(0, colonIndex);
        const after = currentValue.slice(cursorIndex);
        const newValue = before + emoji.native + " " + after;

        if (onChange) {
            const event = {
                target: { value: newValue }
            } as React.ChangeEvent<typeof inputRef.current>;
            onChange(event);
        }
        if (onValueChange) {
            onValueChange(newValue);
        }
        setShowEmojiList(false);
        setUserSelectedIndex(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<EmojiInputElement>) => {
        if (!showEmojiList || filteredEmojis.length === 0) {
            if (e.key === "Enter" && onEnter) {
                onEnter(e);
                return;
            }
            if (e.key === "Escape" && onEscape) {
                onEscape(e);
                return;
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setUserSelectedIndex((prev) => {
                    const current = prev ?? 0;
                    return (current + 1) % filteredEmojis.length;
                });
                break;
            case "ArrowUp":
                e.preventDefault();
                setUserSelectedIndex((prev) => {
                    const current = prev ?? 0;
                    return current - 1 < 0 ? filteredEmojis.length - 1 : current - 1;
                });
                break;
            case "Enter":
                e.preventDefault();
                handleSelectEmoji(filteredEmojis[selectedIndex]);
                break;
            case "Escape":
                e.preventDefault();
                e.stopPropagation();
                setShowEmojiList(false);
                setUserSelectedIndex(null);
                break;
            case "Tab":
                e.preventDefault();
                handleSelectEmoji(filteredEmojis[selectedIndex]);
                break;
        }
    };

    const Component = type === "textarea" ? Textarea : Input;

    return (
        <div className="relative w-full">
            <Component
                ref={inputRef as any}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                {...props}
            />
            {showEmojiList && filteredEmojis.length > 0 && (
                <div className={`absolute ${type === "textarea" ? "bottom-full mb-1" : "top-full mt-1"} left-0 w-full z-9999`}>
                    <Command className="w-full rounded-md border shadow-md bg-popover">
                        <CommandList className="max-h-[300px]">
                            {filteredEmojis.map((emoji, index) => (
                                <CommandItem
                                    key={emoji.id}
                                    onSelect={() => {
                                        setUserSelectedIndex(index);
                                        handleSelectEmoji(emoji);
                                    }}
                                    onMouseEnter={() => setUserSelectedIndex(index)}
                                    className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 ${index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
                                >
                                    <span className="text-lg min-w-[24px]">{emoji.native}</span>
                                    <span className="text-sm text-muted-foreground">:{emoji.id}:</span>
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </div>
            )}
        </div>
    );
};