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
import * as commands from "@codemirror/commands";
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
import { Fragment, useState } from "react";
import { formatSelection } from "./code-mirror/keybindings/selection-formatting";
import { LinkDialog, readClipboardUrl } from "./dialogs/LinkDialog";

type Formatter = Parameters<typeof formatSelection>[1];

/** An editor action, which is shown as a toolbar button (or on mobile, sometimes as a menu item). */
interface FormattingAction {
  Icon: LucideIcon;
  title: string;
  run: () => void;
  disabled: boolean;
}

export function FormattingToolbar({ disabled = false }: { disabled?: boolean }) {
  const view = useSelector(editorViewAtom);
  const { hasSelection, canUndo, canRedo } = useSelector(editorStatusAtom);
  const isMobile = useIsMobile();
  const [linkDialog, setLinkDialog] = useState<{ text: string; url: string } | null>(null);

  if (!view) return null;

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

  const action = (
    Icon: LucideIcon,
    title: string,
    isEnabled: boolean,
    run: () => void,
  ): FormattingAction => ({ Icon, title, run, disabled: disabled || !isEnabled });
  const format = (Icon: LucideIcon, title: string, formatter: Formatter) =>
    action(Icon, title, hasSelection, () => formatSelection(view, formatter));
  const cursor = () => view.state.selection.main.from;

  const undo = action(Undo, "Undo", canUndo, () => commands.undo(view));
  const redo = action(Redo, "Redo", canRedo, () => commands.redo(view));
  const bold = format(Bold, "Bold", "bold");
  const italic = format(Italic, "Italic", "italic");
  const underline = format(Underline, "Underline", "underline");
  const strikethrough = format(Strikethrough, "Strikethrough", "strikethrough");
  const code = format(Code, "Code", "code");
  const quote = format(Quote, "Block quote", "blockQuote");
  const link = action(Link, "Insert link", hasSelection, async () =>
    setLinkDialog({ text: getSelectedText(), url: await readClipboardUrl() }),
  );
  const bookmark = action(Bookmark, "Add bookmark", !hasSelection, () => insert("{#}", cursor()));
  const task = action(CheckSquare, "Add task", !hasSelection, () =>
    insert("- [ ] ", view.state.doc.lineAt(cursor()).from),
  );
  const comment = action(MessageSquare, "Add comment", hasSelection, () =>
    openComments({ quote: getSelectedText() }),
  );
  const search = action(Search, "Search in file", true, () => openSearchPanel(view));

  // Mobile only has room for the most common actions, so the rest are moved into a menu
  const groups = isMobile
    ? [
        [undo, redo],
        [bold, italic, underline],
        [code, link, task],
      ]
    : [
        [undo, redo],
        [bold, italic, underline, strikethrough],
        [code, quote],
        [link, bookmark, task],
        [comment],
      ];
  const overflow = [quote, strikethrough, bookmark, comment];

  const button = ({ Icon, title, run, disabled }: FormattingAction) => (
    <Button
      key={title}
      variant="ghost"
      size="icon-sm"
      title={title}
      onClick={run}
      disabled={disabled}
    >
      <Icon />
    </Button>
  );

  const menuItem = ({ Icon, title, run, disabled }: FormattingAction) => (
    <DropdownMenuItem key={title} onClick={run} disabled={disabled}>
      <Icon /> {title}
    </DropdownMenuItem>
  );

  // (Vertical separators stretch by default, which would pin a fixed-height one to the top of the row)
  const separator = (
    <Separator orientation="vertical" className="mx-1 h-6 data-vertical:self-center" />
  );

  return (
    <div className="border-b bg-muted/30 px-2 py-1 flex gap-1 items-center">
      {groups.map((group, i) => (
        <Fragment key={i}>
          {i > 0 && separator}
          {group.map(button)}
        </Fragment>
      ))}

      {isMobile && (
        <>
          {separator}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={disabled}
              render={<Button variant="ghost" size="icon-sm" aria-label="More formatting" />}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {overflow.map(menuItem)}
              <DropdownMenuSeparator />
              {menuItem(search)}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {linkDialog && (
        <LinkDialog
          initialText={linkDialog.text}
          initialUrl={linkDialog.url}
          onClose={() => setLinkDialog(null)}
          onInsert={(text, url) => formatSelection(view, "link", text, { url })}
        />
      )}
    </div>
  );
}
