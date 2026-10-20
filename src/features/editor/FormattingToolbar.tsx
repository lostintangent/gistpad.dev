import { openComments } from "@/features/comments/store";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Separator } from "@/shared/ui/separator";
import * as commands from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { createAtom, useSelector } from "@tanstack/react-store";
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
import { createPortal } from "react-dom";
import { formatSelection, type Formatter } from "./extensions/writing/formatting";
import { selectionTooltip } from "./extensions/writing/selection-tooltip";
import { LinkDialog, readClipboardUrl } from "./LinkDialog";
import { editorStatusAtom, editorViewAtom } from "./store";

/** An editor action, which is shown as a button (or in the toolbar's menu, as a menu item). */
interface FormattingAction {
  Icon: LucideIcon;
  title: string;
  run: () => void;
  disabled: boolean;
}

/**
 * The editor's formatting actions (which the toolbar and the bubble share), and the link dialog
 * that one of them opens. Or null, while there's no editor.
 */
function useFormattingActions() {
  const view = useSelector(editorViewAtom);
  const { hasSelection, canUndo, canRedo } = useSelector(editorStatusAtom);
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
  ): FormattingAction => ({ Icon, title, run, disabled: view.state.readOnly || !isEnabled });
  const format = (Icon: LucideIcon, title: string, formatter: Formatter) =>
    action(Icon, title, hasSelection, () => formatSelection(view, formatter));
  const cursor = () => view.state.selection.main.from;

  return {
    actions: {
      undo: action(Undo, "Undo", canUndo, () => commands.undo(view)),
      redo: action(Redo, "Redo", canRedo, () => commands.redo(view)),
      bold: format(Bold, "Bold", "bold"),
      italic: format(Italic, "Italic", "italic"),
      underline: format(Underline, "Underline", "underline"),
      strikethrough: format(Strikethrough, "Strikethrough", "strikethrough"),
      code: format(Code, "Code", "code"),
      quote: format(Quote, "Block quote", "blockQuote"),
      link: action(Link, "Insert link", hasSelection, async () =>
        setLinkDialog({ text: getSelectedText(), url: await readClipboardUrl() }),
      ),
      bookmark: action(Bookmark, "Add bookmark", !hasSelection, () => insert("{#}", cursor())),
      task: action(CheckSquare, "Add task", !hasSelection, () =>
        insert("- [ ] ", view.state.doc.lineAt(cursor()).from),
      ),
      comment: action(MessageSquare, "Add comment", hasSelection, () =>
        openComments({ quote: getSelectedText() }),
      ),
      search: action(Search, "Search in file", true, () => openSearchPanel(view)),
    },
    dialog: linkDialog && (
      <LinkDialog
        initialText={linkDialog.text}
        initialUrl={linkDialog.url}
        onClose={() => setLinkDialog(null)}
        onInsert={(text, url) => formatSelection(view, "link", text, { url })}
      />
    ),
  };
}

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

/** Groups of actions, as buttons, with a rule between the groups. */
function ActionGroups({ groups }: { groups: FormattingAction[][] }) {
  return groups.map((group, i) => (
    <Fragment key={i}>
      {i > 0 && separator}
      {group.map(button)}
    </Fragment>
  ));
}

/** The optional toolbar above the editor, with the less common formatting actions in a menu. */
export function FormattingToolbar() {
  const formatting = useFormattingActions();
  if (!formatting) return null;

  const { actions } = formatting;

  return (
    <div className="shrink-0 border-b bg-muted/30 px-2 py-1 flex gap-1 items-center">
      <ActionGroups
        groups={[
          [actions.undo, actions.redo],
          [actions.bold, actions.italic, actions.underline],
          [actions.code, actions.link, actions.task],
        ]}
      />
      {separator}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="More formatting" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {[actions.quote, actions.strikethrough, actions.bookmark, actions.comment].map(menuItem)}
          <DropdownMenuSeparator />
          {menuItem(actions.search)}
        </DropdownMenuContent>
      </DropdownMenu>
      {formatting.dialog}
    </div>
  );
}

/** The tooltip's element (while there's a selection), which the bubble is rendered into. */
const tooltipAtom = createAtom<HTMLElement | null>(null);

/** The editor extension that shows the bubble's tooltip above the selection. */
export const formattingBubble = selectionTooltip({
  mount: (dom) => tooltipAtom.set(dom),
  // (By the time a tooltip is unmounted, the next one may have been mounted in its place)
  unmount: (dom) => tooltipAtom.get() === dom && tooltipAtom.set(null),
});

/**
 * The formatting actions that apply to a selection, as a bubble above it (on desktop), which
 * `formattingBubble` positions.
 */
export function FormattingBubble() {
  const tooltip = useSelector(tooltipAtom);
  const formatting = useFormattingActions();
  if (!formatting) return null;

  const { actions } = formatting;

  return (
    <>
      {tooltip &&
        createPortal(
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-lg border bg-popover text-popover-foreground shadow-md"
            // (So its buttons don't take the focus, and with it the selection, from the editor)
            onMouseDown={(event) => event.preventDefault()}
          >
            <ActionGroups
              groups={[
                [actions.bold, actions.italic, actions.underline, actions.strikethrough],
                [actions.code, actions.quote, actions.link],
                [actions.comment],
              ]}
            />
          </div>,
          tooltip,
        )}
      {formatting.dialog}
    </>
  );
}
