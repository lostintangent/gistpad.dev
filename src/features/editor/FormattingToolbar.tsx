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

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button variant="ghost" size="icon-sm" title={title} onClick={onClick} disabled={disabled}>
      <Icon />
    </Button>
  );
}

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

  const addTask = () =>
    insert("- [ ] ", view.state.doc.lineAt(view.state.selection.main.from).from);
  const addBookmark = () => insert("{#}", view.state.selection.main.from);
  const addComment = () => openComments({ quote: getSelectedText() });

  const needsSelection = !hasSelection || disabled;
  const needsNoSelection = hasSelection || disabled;

  return (
    <div className="bg-muted/40 p-1 border rounded-t-sm flex gap-1 items-center">
      <ToolbarButton
        icon={Undo}
        title="Undo"
        onClick={() => undo(view)}
        disabled={!canUndo || disabled}
      />
      <ToolbarButton
        icon={Redo}
        title="Redo"
        onClick={() => redo(view)}
        disabled={!canRedo || disabled}
      />

      <Separator orientation="vertical" className="h-6" />

      <ToolbarButton
        icon={Bold}
        title="Bold"
        onClick={() => format("bold")}
        disabled={needsSelection}
      />
      <ToolbarButton
        icon={Italic}
        title="Italic"
        onClick={() => format("italic")}
        disabled={needsSelection}
      />
      <ToolbarButton
        icon={Underline}
        title="Underline"
        onClick={() => format("underline")}
        disabled={needsSelection}
      />
      {!isMobile && (
        <ToolbarButton
          icon={Strikethrough}
          title="Strikethrough"
          onClick={() => format("strikethrough")}
          disabled={needsSelection}
        />
      )}

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton
        icon={Code}
        title="Code"
        onClick={() => format("code")}
        disabled={needsSelection}
      />
      {!isMobile && (
        <>
          <ToolbarButton
            icon={Quote}
            title="Block quote"
            onClick={() => format("blockQuote")}
            disabled={needsSelection}
          />
          <Separator orientation="vertical" className="h-6 mx-1" />
        </>
      )}

      <ToolbarButton
        icon={Link}
        title="Insert link"
        onClick={async () => setLink({ text: getSelectedText(), url: await readClipboardUrl() })}
        disabled={needsSelection}
      />
      {!isMobile && (
        <ToolbarButton
          icon={Bookmark}
          title="Add bookmark"
          onClick={addBookmark}
          disabled={needsNoSelection}
        />
      )}
      <ToolbarButton
        icon={CheckSquare}
        title="Add task"
        onClick={addTask}
        disabled={needsNoSelection}
      />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {!isMobile ? (
        <ToolbarButton
          icon={MessageSquare}
          title="Add comment"
          onClick={addComment}
          disabled={needsSelection}
        />
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
