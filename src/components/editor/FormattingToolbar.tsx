import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/useMobile";
import { redo, undo } from "@codemirror/commands";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
    Bold,
    Bookmark,
    CheckSquare,
    Code,
    Italic,
    Link,
    MessageSquare,
    MoreHorizontal,
    Quote,
    Redo,
    Search,
    Strikethrough,
    Underline,
    Undo,
} from "lucide-react";
import { useCallback, useState } from "react";
import { formatSelection } from "./code-mirror/keybindings/selection-formatting";
import { LinkDialog } from "./dialogs/LinkDialog";

interface FormattingButtonProps {
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
    disabled: boolean;
}

function FormattingButton({
    icon,
    onClick,
    disabled,
}: FormattingButtonProps) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClick}
            disabled={disabled}
        >
            {icon}
        </Button>
    );
}

interface FormattingToolbarProps {
    editor: React.MutableRefObject<ReactCodeMirrorRef>;
    hasSelection: boolean;
    canUndo: boolean;
    canRedo: boolean;
    addNewComment: (text: string) => void;
    onSearchInFile: () => void;
    disabled?: boolean;
}

export function FormattingToolbar({
    editor,
    hasSelection,
    canUndo,
    canRedo,
    addNewComment,
    onSearchInFile,
    disabled = false,
}: FormattingToolbarProps) {
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [selectedText, setSelectedText] = useState("");

    const isMobile = useIsMobile();

    const applyFormatting = useCallback(
        (formatter, replacedText?, additionalParams?) =>
            formatSelection(
                editor.current.view,
                formatter,
                replacedText,
                additionalParams
            ),
        [editor]
    );

    const addTasklistItem = useCallback(() => {
        const view = editor.current.view;
        const { state } = view;
        const line = state.doc.lineAt(state.selection.main.from);

        view.dispatch(
            view.state.update({
                changes: {
                    from: line.from,
                    insert: "- [ ] ",
                },
                selection: { anchor: line.from + 6 },
            })
        );
    }, [editor]);

    const addBookmark = useCallback(() => {
        const view = editor.current.view;
        const { from, to } = view.state.selection.main;
        if (from !== to) {
            return;
        }

        view.dispatch(
            view.state.update({
                changes: { from, insert: "{#}" },
                selection: { anchor: from + 3 },
            })
        );
    }, [editor]);

    const addComment = useCallback(() => {
        const { state } = editor.current.view;
        const { from, to } = state.selection.main;
        const selectedText = state.sliceDoc(from, to);

        if (selectedText) {
            addNewComment(selectedText);
        }
    }, [editor, addNewComment]);

    const openLinkDialog = useCallback(() => {
        const { state } = editor.current.view;
        const { from, to } = state.selection.main;
        const text = state.sliceDoc(from, to);
        setSelectedText(text);
        setIsLinkDialogOpen(true);
    }, [editor]);

    return (
        <div
            id="cm-formatting-toolbar"
            className="bg-muted/40 p-1 border-b border-l border-r border-t rounded-t-sm flex gap-1 items-center"
        >
            <FormattingButton
                icon={<Undo className="h-4 w-4" />}
                title="Undo"
                onClick={() => undo(editor.current.view)}
                disabled={!canUndo || disabled}
            />
            <FormattingButton
                icon={<Redo className="h-4 w-4" />}
                title="Redo"
                onClick={() => redo(editor.current.view)}
                disabled={!canRedo || disabled}
            />

            <Separator orientation="vertical" className="h-6" />

            <FormattingButton
                icon={<Bold className="h-4 w-4" />}
                title="Bold"
                onClick={() => applyFormatting("bold")}
                disabled={!hasSelection || disabled}
            />
            <FormattingButton
                icon={<Italic className="h-4 w-4" />}
                title="Italic"
                onClick={() => applyFormatting("italic")}
                disabled={!hasSelection || disabled}
            />
            <FormattingButton
                icon={<Underline className="h-4 w-4" />}
                title="Underline"
                onClick={() => applyFormatting("underline")}
                disabled={!hasSelection || disabled}
            />
            {!isMobile && (
                <FormattingButton
                    icon={<Strikethrough className="h-4 w-4" />}
                    title="Strikethrough"
                    onClick={() => applyFormatting("strikethrough")}
                    disabled={!hasSelection || disabled}
                />
            )}

            <Separator orientation="vertical" className="h-6 mx-1" />

            <FormattingButton
                icon={<Code className="h-4 w-4" />}
                title="Code"
                onClick={() => applyFormatting("code")}
                disabled={!hasSelection || disabled}
            />

            {!isMobile && (
                <>
                    <FormattingButton
                        icon={<Quote className="h-4 w-4" />}
                        title="Block Quote"
                        onClick={() => applyFormatting("blockQuote")}
                        disabled={!hasSelection || disabled}
                    />
                    <Separator orientation="vertical" className="h-6 mx-1" />
                </>
            )}

            <FormattingButton
                icon={<Link className="h-4 w-4" />}
                title="Insert Link"
                onClick={openLinkDialog}
                disabled={!hasSelection || disabled}
            />

            {!isMobile && (
                <FormattingButton
                    icon={<Bookmark className="h-4 w-4" />}
                    title="Add Bookmark"
                    onClick={addBookmark}
                    disabled={hasSelection || disabled}
                />
            )}

            <FormattingButton
                icon={<CheckSquare className="h-4 w-4" />}
                title="Add Task"
                onClick={addTasklistItem}
                disabled={hasSelection || disabled}
            />

            <Separator orientation="vertical" className="h-6 mx-1" />

            {!isMobile ? (
                <FormattingButton
                    icon={<MessageSquare className="h-4 w-4" />}
                    title="Add Comment"
                    onClick={addComment}
                    disabled={!hasSelection || disabled}
                />
            ) : (
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={disabled}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem
                            onClick={() => applyFormatting("blockQuote")}
                            disabled={!hasSelection || disabled}
                            className="flex items-center gap-2"
                        >
                            <Quote className="h-4 w-4" />
                            <span>Block Quote</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => applyFormatting("strikethrough")}
                            disabled={!hasSelection || disabled}
                            className="flex items-center gap-2"
                        >
                            <Strikethrough className="h-4 w-4" />
                            <span>Strikethrough</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={addBookmark}
                            disabled={hasSelection || disabled}
                            className="flex items-center gap-2"
                        >
                            <Bookmark className="h-4 w-4" />
                            <span>Add bookmark</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={addComment}
                            disabled={!hasSelection || disabled}
                            className="flex items-center gap-2"
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span>Add Comment</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onSearchInFile}
                            disabled={disabled}
                            className="flex items-center gap-2"
                        >
                            <Search className="h-4 w-4" />
                            <span>Search in file</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <LinkDialog
                isOpen={isLinkDialogOpen}
                onClose={() => setIsLinkDialogOpen(false)}
                onInsert={(text, url) => applyFormatting("link", text, { url })}
                initialText={selectedText}
            />
        </div>
    );
}
