import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { getRequiredOptions, widgetRegistry } from "./registry";
import { addWidget, moveWidget, removeUnconfiguredWidgets, widgetsAtom } from "./store";
import { Widget } from "./Widget";

/** The dashboard's widgets (which are loaded on demand, when it's first opened). */
export default function WidgetList({
  ref: widgetListRef,
  isEditMode,
  onEditModeChange: setEditMode,
}: {
  ref: RefObject<HTMLDivElement | null>;
  isEditMode: boolean;
  onEditModeChange: (isEditMode: boolean) => void;
}) {
  const widgets = useSelector(widgetsAtom);
  const [availableCollapsed, setAvailableCollapsed] = useState(false);

  // While dragging a widget, where it would be dropped (as an index into the list of widgets)
  const [drag, setDrag] = useState<{ id: string; dropIndex: number | null } | null>(null);
  const draggedIndex = widgets.findIndex((widget) => widget.id === drag?.id);
  const dropIndex =
    drag?.dropIndex === draggedIndex || drag?.dropIndex === draggedIndex + 1
      ? null
      : drag?.dropIndex;

  const add = (type: string) => {
    const { id } = flushSync(() => addWidget(type));
    widgetListRef.current
      ?.querySelector(`[data-widget-id="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const wasEditing = useRef(isEditMode);
  useEffect(() => {
    if (wasEditing.current && !isEditMode) removeUnconfiguredWidgets();
    wasEditing.current = isEditMode;
  }, [isEditMode]);

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
      {/* The widgets scroll together (like the gist list), beneath the dashboard's header */}
      <ScrollArea className="flex-1 min-h-0">
        <div
          ref={widgetListRef}
          // (Its widgets' chevrons are as far from the workspace as the gist list's edge is)
          className={`space-y-4 pl-1 pr-2 pb-6 ${isEditMode ? "edit-mode" : ""}`}
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
              // (Ignoring drags of its content, e.g. a link, which includes its dialogs' content)
              onDragStart={(e) =>
                e.target === e.currentTarget && setDrag({ id: widget.id, dropIndex: null })
              }
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
                "relative first:mt-1 scroll-mt-3 rounded-lg transition-all",
                isEditMode && "cursor-move",
                drag?.id === widget.id && "opacity-30",
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
                index={index}
                isLast={index === widgets.length - 1}
                isEditMode={isEditMode}
                onEditModeChange={setEditMode}
              />
            </div>
          ))}
        </div>
      </ScrollArea>

      {isEditMode && availableWidgets.length > 0 && (
        <div className="border-t p-3 bg-backdrop">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Add widget to dashboard</h4>
            <Button
              variant="ghost"
              size="icon-xs"
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
                  <Button variant="outline" size="sm" onClick={() => add(type)}>
                    <Plus /> Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
