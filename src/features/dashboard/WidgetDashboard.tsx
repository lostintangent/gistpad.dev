import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { SheetClose, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { persistedAtom } from "@/shared/persistedAtom";
import { useTransientState } from "@/shared/useTransientState";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit,
  ListEnd,
  ListStart,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CommentsDialog } from "./comments/CommentsDialog";
import { MediaDialog } from "./MediaDialog";
import {
  createWidget,
  getDefaultWidgets,
  getRequiredOptions,
  getWidgetTitle,
  isConfigured,
  widgetRegistry,
  type WidgetState,
} from "./registry";
import type { CommentThread, Media } from "./types";
import { Widget } from "./Widget";

/** The widgets on the dashboard (skipping any whose type no longer exists, e.g. Reddit). */
const widgetsAtom = persistedAtom<WidgetState[]>("gistpad-widget-config", getDefaultWidgets(), {
  parse: (value) => (JSON.parse(value) as WidgetState[]).filter(({ type }) => widgetRegistry[type]),
  stringify: JSON.stringify,
});

const updateWidget = (id: string, changes: Partial<WidgetState>) =>
  widgetsAtom.set((widgets) =>
    widgets.map((widget) => (widget.id === id ? { ...widget, ...changes } : widget)),
  );

/** Moves a widget to a new position in the list. */
const moveWidget = (id: string, toIndex: number) =>
  widgetsAtom.set((widgets) => {
    const widget = widgets.find((widget) => widget.id === id)!;
    return widgets.filter((widget) => widget.id !== id).toSpliced(toIndex, 0, widget);
  });

/** Removes widgets that weren't configured (e.g. a new AI widget that wasn't given a prompt). */
const removeUnconfiguredWidgets = () =>
  widgetsAtom.set((widgets) =>
    widgets.filter((widget) => isConfigured(widgetRegistry[widget.type], widget.config)),
  );

/** The news dashboard's contents (which are loaded on demand, when it's first opened). */
export default function WidgetDashboard() {
  const widgets = useSelector(widgetsAtom);
  const [isEditMode, setIsEditMode] = useState(false);
  const [commentsDialog, setCommentsDialog] = useState<CommentThread | null>(null);
  const [mediaDialogItem, setMediaDialogItem] = useState<Media | null>(null);
  const [availableCollapsed, setAvailableCollapsed] = useState(false);
  const [highlightedId, setHighlightedId] = useTransientState<string | null>(null);
  const widgetListRef = useRef<HTMLDivElement>(null);

  // While dragging a widget, where it would be dropped (as an index into the list of widgets)
  const [drag, setDrag] = useState<{ id: string; dropIndex: number | null } | null>(null);
  const draggedIndex = widgets.findIndex((widget) => widget.id === drag?.id);
  const dropIndex =
    drag?.dropIndex === draggedIndex || drag?.dropIndex === draggedIndex + 1
      ? null
      : drag?.dropIndex;

  const getWidgetElement = (id: string) =>
    widgetListRef.current?.querySelector(`[data-widget-id="${id}"]`);

  const addWidget = (type: string, position: "top" | "bottom") => {
    const widget = createWidget(type);
    flushSync(() =>
      widgetsAtom.set((widgets) =>
        position === "top" ? [widget, ...widgets] : [...widgets, widget],
      ),
    );
    getWidgetElement(widget.id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const scrollToWidget = (id: string) => {
    getWidgetElement(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedId(id);
  };

  /** Rejects a config that would duplicate another widget (e.g. the same sport). */
  const saveConfig = (widget: WidgetState, config: Record<string, string>) => {
    const requiredOptions = getRequiredOptions(widgetRegistry[widget.type]);
    const isDuplicate = widgets.some(
      (other) =>
        other.id !== widget.id &&
        other.type === widget.type &&
        requiredOptions.every(({ id }) => other.config?.[id] === config[id]),
    );

    if (isDuplicate) return "Widget already exists with this configuration";
    updateWidget(widget.id, { config });
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    removeUnconfiguredWidgets();
  };

  // Closing the dashboard also leaves edit mode (since its state is reset when it's closed)
  useEffect(() => removeUnconfiguredWidgets, []);

  // Widgets that require config can be added multiple times (e.g. for different sports)
  const availableWidgets = Object.entries(widgetRegistry)
    .filter(
      ([type, definition]) =>
        getRequiredOptions(definition).length > 0 ||
        !widgets.some((widget) => widget.type === type),
    )
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));

  return (
    <>
      <SheetHeader className="py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SheetTitle
              className="cursor-pointer"
              onClick={() => widgetListRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            >
              News Dashboard
            </SheetTitle>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-xs" title="Jump to widget" />}
              >
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                {widgets.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No widgets added</div>
                ) : (
                  widgets.map((widget, index) => (
                    <DropdownMenuItem
                      key={widget.id}
                      onClick={() => scrollToWidget(widget.id)}
                      className="cursor-pointer"
                    >
                      <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                      {getWidgetTitle(widget)}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={isEditMode ? exitEditMode : () => setIsEditMode(true)}
              className={cn(
                "h-8 w-8",
                isEditMode && "hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20",
              )}
              title={isEditMode ? "Save and exit edit mode" : "Edit widgets"}
            >
              {isEditMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            </Button>
            <div className="h-4 w-px bg-border" />
            <SheetClose render={<Button variant="ghost" size="icon-sm" title="Close dashboard" />}>
              <PanelLeftOpen className="h-4 w-4" />
            </SheetClose>
          </div>
        </div>
      </SheetHeader>
      <div
        ref={widgetListRef}
        className={`space-y-3 px-3 pb-6 overflow-y-auto flex-1 ${isEditMode ? "edit-mode" : ""}`}
        // (So that widgets can also be dropped in the gaps between them)
        onDragOver={(e) => drag && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (drag && dropIndex != null) {
            moveWidget(drag.id, draggedIndex < dropIndex ? dropIndex - 1 : dropIndex);
          }
          setDrag(null);
        }}
      >
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            data-widget-id={widget.id}
            draggable={isEditMode}
            onDragStart={() => setDrag({ id: widget.id, dropIndex: null })}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();

              // Dropping on the top half of a widget places it before it (otherwise, after it)
              const { top, height } = e.currentTarget.getBoundingClientRect();
              const dropIndex = e.clientY < top + height / 2 ? index : index + 1;
              if (dropIndex !== drag.dropIndex) setDrag({ ...drag, dropIndex });
            }}
            className={cn(
              "relative first:mt-3 scroll-mt-3 rounded-lg transition-all",
              isEditMode && "cursor-move",
              drag?.id === widget.id && "opacity-30",
              highlightedId === widget.id && "ring-1 ring-primary ring-offset-1",
              // The drop indicator, which is centered in the gap before (or after) the widget
              dropIndex === index &&
                "before:absolute before:inset-x-0 before:-top-[7px] before:h-0.5 before:bg-primary",
              dropIndex === widgets.length &&
                index === widgets.length - 1 &&
                "after:absolute after:inset-x-0 after:-bottom-[7px] after:h-0.5 after:bg-primary",
            )}
          >
            <Widget
              widget={widget}
              isEditMode={isEditMode}
              isFirst={index === 0}
              isLast={index === widgets.length - 1}
              onEnterEditMode={() => setIsEditMode(true)}
              onExitEditMode={exitEditMode}
              onToggleCollapsed={() => updateWidget(widget.id, { collapsed: !widget.collapsed })}
              onMoveUp={() => moveWidget(widget.id, index - 1)}
              onMoveDown={() => moveWidget(widget.id, index + 1)}
              onRemove={() =>
                widgetsAtom.set((widgets) => widgets.filter(({ id }) => id !== widget.id))
              }
              onSaveConfig={(config) => saveConfig(widget, config)}
              openCommentsDialog={setCommentsDialog}
              displayMediaDialog={setMediaDialogItem}
            />
          </div>
        ))}
      </div>

      {isEditMode && availableWidgets.length > 0 && (
        <div className="border-t p-3 bg-background sticky bottom-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Add widget to dashboard</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setAvailableCollapsed(!availableCollapsed)}
              title={availableCollapsed ? "Expand" : "Collapse"}
            >
              {availableCollapsed ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ${availableCollapsed ? "max-h-0" : "max-h-[500px]"}`}
          >
            <div className="space-y-2 pt-2">
              {availableWidgets.map(([type, { name }]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addWidget(type, "top")}
                    title="Add to top"
                  >
                    <ListStart className="mr-1 h-4 w-4" /> Top
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addWidget(type, "bottom")}
                    title="Add to bottom"
                  >
                    <ListEnd className="mr-1 h-4 w-4" /> Bottom
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {commentsDialog && (
        <CommentsDialog onClose={() => setCommentsDialog(null)} {...commentsDialog} />
      )}

      {mediaDialogItem && (
        <MediaDialog media={mediaDialogItem} onClose={() => setMediaDialogItem(null)} />
      )}
    </>
  );
}
