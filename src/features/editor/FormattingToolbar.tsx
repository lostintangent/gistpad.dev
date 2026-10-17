import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Separator } from "@/shared/ui/separator";
import { useIsMobile } from "@/shared/useMediaQuery";
import { openComments } from "@/features/comments/store";
import { editorStatusAtom, editorViewAtom } from "./store";
import { redo, undo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { useSelector } from "@tanstack/react-store";
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
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { formatSelection } from "./code-mirror/keybindings/selection-formatting";
import { LinkDialog, readClipboardUrl } from "./dialogs/LinkDialog";

export function FormattingToolbar({ disabled = false }: { disabled?: boolean }) {
  const view = useSelector(editorViewAtom);
  const { hasSelection, canUndo, canRedo } = useSelector(editorStatusAtom);
  const isMobile = useIsMobile();
  const [link, setLink] = useState<{ text: string; url: string } | null>(null);

  if (!view) return null;

  const format = (formatter: Parameters<typeof formatSelection>[1]) =>
    formatSelection(view, formatter);
  const getSelectedText = () => {
    const { from, to } = view.state.selection.main;
    return view.state.sliceDoc(from, to);
  };

  /** Inserts text at the cursor, and then places the cursor after it. */
  const insert = (text: string, position: number) =>
    view.dispatch({
      changes: { from: position, insert: text },
      selection: { anchor: position + text.length },
    });

  const insertLink = async () =>
    setLink({ text: getSelectedText(), url: await readClipboardUrl() });
  const addTask = () =>
    insert("- [ ] ", view.state.doc.lineAt(view.state.selection.main.from).from);
  const addBookmark = () => insert("{#}", view.state.selection.main.from);
  const addComment = () => openComments({ quote: getSelectedText() });

  const needsSelection = !hasSelection || disabled;
  const needsNoSelection = hasSelection || disabled;

  const button = (Icon: LucideIcon, title: string, onClick: () => void, isDisabled: boolean) => (
    <Button variant="ghost" size="icon-sm" title={title} onClick={onClick} disabled={isDisabled}>
      <Icon />
    </Button>
  );

  // (Vertical separators stretch by default, which would pin a fixed-height one to the top of the row)
  const separator = (
    <Separator orientation="vertical" className="mx-1 h-6 data-vertical:self-center" />
  );

  return (
    <div className="border-b bg-muted/30 px-2 py-1 flex gap-1 items-center">
      {button(Undo, "Undo", () => undo(view), !canUndo || disabled)}
      {button(Redo, "Redo", () => redo(view), !canRedo || disabled)}

      {separator}

      {button(Bold, "Bold", () => format("bold"), needsSelection)}
      {button(Italic, "Italic", () => format("italic"), needsSelection)}
      {button(Underline, "Underline", () => format("underline"), needsSelection)}
      {!isMobile &&
        button(Strikethrough, "Strikethrough", () => format("strikethrough"), needsSelection)}

      {separator}

      {button(Code, "Code", () => format("code"), needsSelection)}
      {!isMobile && (
        <>
          {button(Quote, "Block quote", () => format("blockQuote"), needsSelection)}
          {separator}
        </>
      )}

      {button(Link, "Insert link", insertLink, needsSelection)}
      {!isMobile && button(Bookmark, "Add bookmark", addBookmark, needsNoSelection)}
      {button(CheckSquare, "Add task", addTask, needsNoSelection)}

      {separator}

      {!isMobile ? (
        button(MessageSquare, "Add comment", addComment, needsSelection)
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            render={<Button variant="ghost" size="icon-sm" aria-label="More formatting" />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => format("blockQuote")} disabled={needsSelection}>
              <Quote /> Block quote
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => format("strikethrough")} disabled={needsSelection}>
              <Strikethrough /> Strikethrough
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addBookmark} disabled={needsNoSelection}>
              <Bookmark /> Add bookmark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addComment} disabled={needsSelection}>
              <MessageSquare /> Add comment
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSearchPanel(view)} disabled={disabled}>
              <Search /> Search in file
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {link && (
        <LinkDialog
          initialText={link.text}
          initialUrl={link.url}
          onClose={() => setLink(null)}
          onInsert={(text, url) => formatSelection(view, "link", text, { url })}
        />
      )}
    </div>
  );
}
