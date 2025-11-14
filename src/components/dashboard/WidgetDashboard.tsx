import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit,
  ListEnd,
  ListStart,
  Newspaper,
  PanelLeftOpen,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { CommentsDialog } from "./comments/CommentsDialog";
import { MediaDialog } from "./MediaDialog";
import { getAllWidgetTypes, getDefaultWidgets, getWidget } from "./registry";
import { Comment, MediaItem } from "./types";
import { Widget } from "./Widget";

// Import the scrollend polyfill
import "@af-utils/scrollend-polyfill";

const WIDGET_CONFIG_KEY = "gistpad-widget-config";

interface WidgetState {
  id: string;
  type: string;
  name: string;
  collapsed?: boolean;
  config?: Record<string, string>;
}

interface CommentsDialogConfig {
  title: string;
  queryKey: any[];
  text?: string;
  fetchComments: () => Promise<Comment[]>;
}

export function WidgetDashboard() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModeTriggeredByLongPress, setEditModeTriggeredByLongPress] =
    useState(false);
  const [editingConfigWidgets, setEditingConfigWidgets] = useState<Set<string>>(
    new Set()
  );
  const [commentsDialog, setCommentsDialog] =
    useState<CommentsDialogConfig | null>(null);
  const [mediaDialogItem, setMediaDialogItem] = useState<
    string | MediaItem | MediaItem[] | null
  >(null);
  const [availableCollapsed, setAvailableCollapsed] = useState(false);
  const widgetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [widgets, setWidgets] = useState<WidgetState[]>(() => {
    const saved = localStorage.getItem(WIDGET_CONFIG_KEY);
    if (saved) {
      try {
        const savedWidgets = JSON.parse(saved) as Array<{
          id: string;
          type: string;
          collapsed?: boolean;
          config?: Record<string, string>;
        }>;
        const allWidgetTypes = getAllWidgetTypes();
        // Map saved widgets back to widget components with collapsed state
        return savedWidgets
          .map((savedWidget) => {
            const widget = allWidgetTypes.find(
              (w) => w.type === savedWidget.type
            );
            if (!widget) return null;
            return {
              id: savedWidget.id,
              type: widget.type,
              name: widget.name,
              collapsed: savedWidget.collapsed || false,
              config: savedWidget.config,
            } as WidgetState;
          })
          .filter((w): w is WidgetState => w !== null);
      } catch {
        return getDefaultWidgets();
      }
    }
    return getDefaultWidgets();
  });

  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const widgetListRef = useRef<HTMLDivElement>(null);

  // Save widget configuration whenever it changes
  useEffect(() => {
    const widgetData = widgets.map((w) => ({
      id: w.id,
      type: w.type,
      collapsed: w.collapsed || false,
      config: w.config,
    }));
    localStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(widgetData));
  }, [widgets]);

  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedIndex = widgets.findIndex((w) => w.id === draggedWidget);
    if (draggedIndex === -1) return;

    // If hovering over the same widget, don't show placeholder
    if (index === draggedIndex) {
      setDragOverIndex(null);
      return;
    }

    // Special case for dropping at the end of the list
    if (index === widgets.length) {
      setDragOverIndex(widgets.length);
      return;
    }

    // For widget drops, calculate position based on cursor position within the widget
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const isTopHalf = y < height / 2;

    let dropIndex: number;
    if (isTopHalf) {
      dropIndex = index;
    } else {
      dropIndex = index + 1;
    }

    if (dropIndex !== dragOverIndex) {
      setDragOverIndex(dropIndex);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedWidget || dragOverIndex === null) return;

    const draggedIndex = widgets.findIndex((w) => w.id === draggedWidget);
    if (draggedIndex === -1) return;

    // Don't do anything if dropping in the same position
    if (draggedIndex === dragOverIndex || draggedIndex + 1 === dragOverIndex) {
      setDraggedWidget(null);
      setDragOverIndex(null);
      return;
    }

    const newWidgets = [...widgets];
    const [removed] = newWidgets.splice(draggedIndex, 1);

    // Adjust drop index if dragging from before the drop position
    const adjustedDropIndex =
      draggedIndex < dragOverIndex ? dragOverIndex - 1 : dragOverIndex;
    newWidgets.splice(adjustedDropIndex, 0, removed);

    setWidgets(newWidgets);
    setDraggedWidget(null);
    setDragOverIndex(null);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(widgets.filter((w) => w.id !== widgetId));
  };

  const handleAddWidget = (
    widgetType: string,
    position: "top" | "bottom" = "bottom"
  ) => {
    const allWidgetTypes = getAllWidgetTypes();
    const widgetToAdd = allWidgetTypes.find((w) => w.type === widgetType);
    if (widgetToAdd) {
      const widgetDef = getWidget(widgetToAdd.type);

      // Create default config from config options with default values
      let defaultConfig: Record<string, string> | undefined;
      if (widgetDef?.config) {
        defaultConfig = {};
        widgetDef.config.forEach((opt) => {
          if (opt.default !== undefined) {
            defaultConfig![opt.id] = String(opt.default);
          }
        });
        // Only set config if there are default values
        if (Object.keys(defaultConfig).length === 0) {
          defaultConfig = undefined;
        }
      }

      const newWidget = {
        id: crypto.randomUUID(),
        type: widgetToAdd.type,
        name: widgetToAdd.name,
        collapsed: false,
        config: defaultConfig,
      };
      setWidgets(
        position === "top" ? [newWidget, ...widgets] : [...widgets, newWidget]
      );
      setTimeout(() => {
        if (position === "top") {
          widgetListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          widgetListRef.current?.scrollTo({
            top: widgetListRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 0);
    }
  };

  const moveWidget = (widgetId: string, direction: "up" | "down") => {
    setWidgets((prev) => {
      const index = prev.findIndex((w) => w.id === widgetId);
      if (index === -1) return prev;
      const newWidgets = [...prev];
      const targetIndex =
        direction === "up"
          ? Math.max(0, index - 1)
          : Math.min(prev.length - 1, index + 1);
      [newWidgets[index], newWidgets[targetIndex]] = [
        newWidgets[targetIndex],
        newWidgets[index],
      ];
      return newWidgets;
    });
  };

  const handleToggleCollapsed = (widgetId: string) => {
    setWidgets(
      widgets.map((w) =>
        w.id === widgetId ? { ...w, collapsed: !w.collapsed } : w
      )
    );
  };

  // Get available widgets (not currently displayed)
  const availableWidgets = getAllWidgetTypes()
    .filter((widget) => {
      const widgetDef = getWidget(widget.type);
      const exists = widgets.some((w) => w.type === widget.type);
      // If widget has config, it can be added multiple times (configurable widgets)
      // If no config or only has default values, only allow one instance
      const hasNonDefaultConfig = widgetDef?.config?.some(
        (opt) => opt.default === undefined
      );
      return hasNonDefaultConfig ? true : !exists;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const exitEditMode = () => {
    setIsEditMode(false);
    setEditModeTriggeredByLongPress(false);
    // Clear all widgets from edit config mode when exiting edit mode
    setEditingConfigWidgets(new Set());
  };

  const focusClasses = ["ring-1", "ring-primary", "ring-offset-1"];
  const focusWidget = (widgetElement: HTMLDivElement) => {
    widgetElement.classList.add(...focusClasses);
    setTimeout(() => {
      widgetElement.classList.remove(...focusClasses);
    }, 2000);
  };

  const scrollToWidget = (widgetId: string) => {
    const widgetElement = widgetRefs.current.get(widgetId);
    if (widgetElement && widgetListRef.current) {
      const containerRect = widgetListRef.current.getBoundingClientRect();
      const widgetRect = widgetElement.getBoundingClientRect();
      const scrollTop = widgetListRef.current.scrollTop;
      const targetScroll =
        scrollTop + (widgetRect.top - containerRect.top) - 12;

      // Check if scrolling is needed
      const isScrollable =
        widgetListRef.current.scrollHeight > widgetListRef.current.clientHeight;
      const isAlreadyAtTarget = Math.abs(scrollTop - targetScroll) < 1;

      // Clamp target scroll to valid range
      const maxScroll =
        widgetListRef.current.scrollHeight - widgetListRef.current.clientHeight;
      const clampedTarget = Math.max(0, Math.min(targetScroll, maxScroll));
      const willActuallyScroll = Math.abs(scrollTop - clampedTarget) > 1;

      if (!isScrollable || isAlreadyAtTarget || !willActuallyScroll) {
        // No scrolling needed, just highlight the widget visually
        focusWidget(widgetElement);
      } else {
        widgetListRef.current.addEventListener(
          "scrollend",
          () => focusWidget(widgetElement),
          { once: true }
        );

        widgetListRef.current.scrollTo({
          top: targetScroll,
          behavior: "smooth",
        });
      }
    }
  };

  const getWidgetDisplayTitle = (widget: WidgetState) => {
    const widgetDef = getWidget(widget.type);
    if (!widgetDef) return widget.name;

    // Use the first config option without a default value for the title
    const titleConfigOption = widgetDef.config?.find(
      (opt) => opt.default === undefined
    );
    const topConfigValue =
      titleConfigOption?.id && widget.config
        ? widget.config[titleConfigOption.id]
        : undefined;
    return topConfigValue
      ? `${widgetDef.name} (${topConfigValue})`
      : widgetDef.name;
  };

  return (
    <Sheet
      onOpenChange={(open) => {
        // Exit edit mode when the sheet is closed
        if (!open && isEditMode) {
          exitEditMode();
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          title="Open news dashboard"
        >
          <Newspaper className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-[100vw] md:w-[400px] flex flex-col gap-0 border-l-0 md:border-l md:border-l-border [&>button]:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader className="py-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle
                className="cursor-pointer"
                onClick={() => {
                  widgetListRef.current?.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
              >
                News Dashboard
              </SheetTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Jump to widget"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-80 overflow-y-auto"
                >
                  {widgets.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No widgets added
                    </div>
                  ) : (
                    widgets.map((widget, index) => {
                      return (
                        <DropdownMenuItem
                          key={widget.id}
                          onClick={() => scrollToWidget(widget.id)}
                          className="cursor-pointer"
                        >
                          <span className="mr-2 text-muted-foreground">
                            {index + 1}.
                          </span>
                          {getWidgetDisplayTitle(widget)}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-1">
              {isEditMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Clear all widgets from edit config mode
                      setEditingConfigWidgets(new Set());
                      // When exiting edit mode, remove widgets that require config but don't have it
                      setWidgets((prev) =>
                        prev.filter((widget) => {
                          const widgetDef = getWidget(widget.type);
                          // Only require config for options without default values
                          const configOptionsWithoutDefaults =
                            widgetDef?.config?.filter(
                              (opt) => opt.default === undefined
                            ) || [];
                          const requiresConfig =
                            configOptionsWithoutDefaults.length > 0;

                          // Check if all required config options have values
                          const hasRequiredConfig =
                            configOptionsWithoutDefaults.every(
                              (opt) =>
                                widget.config &&
                                widget.config[opt.id] &&
                                widget.config[opt.id].trim() !== ""
                            );

                          // Keep widget if it doesn't require config OR if it has all required config
                          return !requiresConfig || hasRequiredConfig;
                        })
                      );
                      setIsEditMode(false);
                    }}
                    className="h-8 w-8 hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
                    title="Save and exit edit mode"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditMode(true);
                  }}
                  className="h-8 w-8"
                  title="Edit widgets"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <div className="h-4 w-px bg-border" />
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Close dashboard"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>
        <div
          ref={widgetListRef}
          className={`space-y-3 px-3 pb-6 overflow-y-auto flex-1 ${isEditMode ? "edit-mode" : ""}`}
          onClick={(e) => e.stopPropagation()}
          onDragOver={(e) => {
            if (!draggedWidget) return;
            e.preventDefault();

            // Get all widget elements
            const widgetElements = Array.from(
              e.currentTarget.querySelectorAll("[data-widget]")
            );
            const mouseY = e.clientY;

            // Check if mouse is above the first widget
            if (widgetElements.length > 0) {
              const firstWidget = widgetElements[0] as HTMLElement;
              const firstWidgetRect = firstWidget.getBoundingClientRect();

              if (mouseY < firstWidgetRect.top) {
                setDragOverIndex(0);
                return;
              }

              // Check if mouse is below the last widget
              const lastWidget = widgetElements[
                widgetElements.length - 1
              ] as HTMLElement;
              const lastWidgetRect = lastWidget.getBoundingClientRect();

              if (mouseY > lastWidgetRect.bottom) {
                setDragOverIndex(widgets.length);
                return;
              }
            }
          }}
          onDrop={handleDrop}
        >
          {/* Drag and drop placeholder (top) */}
          {dragOverIndex === 0 && draggedWidget && (
            <div
              className="h-8 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 mb-3 transition-all duration-200"
              onDrop={handleDrop}
            />
          )}

          {/* Widgets list */}
          {widgets.map((widget, index) => {
            const widgetDef = getWidget(widget.type);
            if (!widgetDef) return null;

            const isDragging = draggedWidget === widget.id;
            const showPlaceholder =
              dragOverIndex === index + 1 &&
              draggedWidget !== null &&
              !isDragging &&
              dragOverIndex !== widgets.length;

            return (
              <React.Fragment key={widget.id}>
                <div
                  ref={(el) => {
                    if (el) widgetRefs.current.set(widget.id, el);
                  }}
                  data-widget
                  draggable={isEditMode}
                  onDragStart={() => handleDragStart(widget.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  className={`${isEditMode ? "cursor-move" : ""} ${isDragging ? "opacity-30" : ""
                    } first:mt-3 rounded-lg transition-all`}
                >
                  <Widget
                    title={getWidgetDisplayTitle(widget)}
                    fetcher={widgetDef.fetchData}
                    staleTime={widgetDef.staleTime}
                    onRemove={() => handleRemoveWidget(widget.id)}
                    collapsed={widget.collapsed}
                    onToggleCollapsed={() => handleToggleCollapsed(widget.id)}
                    configOptions={widgetDef.config}
                    config={widget.config}
                    emptyStateMessage={widgetDef.emptyStateMessage}
                    checkEmpty={widgetDef.checkEmpty}
                    getExternalUrl={widgetDef.getExternalUrl}
                    getBadge={widgetDef.getBadge}
                    onEnterEditMode={() => {
                      setIsEditMode(true);
                      setEditModeTriggeredByLongPress(true);
                    }}
                    onExitEditMode={exitEditMode}
                    onSaveConfig={(config) => {
                      // Check for duplicate widgets based on non-optional config only
                      const widgetDef = getWidget(widget.type);
                      const nonOptionalConfigKeys =
                        widgetDef?.config
                          ?.filter((opt) => opt.default === undefined)
                          .map((opt) => opt.id) || [];

                      const isDuplicate = widgets.some((w) => {
                        if (w.id === widget.id || w.type !== widget.type) {
                          return false;
                        }

                        // Compare only non-optional config values
                        return nonOptionalConfigKeys.every(
                          (key) => w.config?.[key] === config[key]
                        );
                      });

                      if (isDuplicate) {
                        return "Widget already exists with this configuration";
                      }

                      setWidgets((prev) =>
                        prev.map((w) =>
                          w.id === widget.id ? { ...w, config } : w
                        )
                      );
                      // Remove from editing set when saved
                      setEditingConfigWidgets((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(widget.id);
                        return newSet;
                      });

                      // If edit mode was triggered by long press, exit edit mode after saving
                      if (editModeTriggeredByLongPress) {
                        exitEditMode();
                      }
                    }}
                    onCancelConfig={() => {
                      // If edit mode was triggered by long press, exit edit mode after canceling
                      if (editModeTriggeredByLongPress) {
                        exitEditMode();
                      }
                    }}
                    onMoveUp={() => moveWidget(widget.id, "up")}
                    onMoveDown={() => moveWidget(widget.id, "down")}
                    position={{ index, total: widgets.length }}
                    isEditingConfig={editingConfigWidgets.has(widget.id)}
                    onEditConfigChange={(editing) => {
                      setEditingConfigWidgets((prev) => {
                        const newSet = new Set(prev);
                        if (editing) {
                          newSet.add(widget.id);
                        } else {
                          newSet.delete(widget.id);
                        }
                        return newSet;
                      });
                    }}
                  >
                    {(data, isLoading) => {
                      const WidgetComponent = widgetDef.component;
                      return (
                        <WidgetComponent
                          data={data}
                          isLoading={isLoading}
                          config={widget.config}
                          openCommentsDialog={setCommentsDialog}
                          displayMediaDialog={setMediaDialogItem}
                        />
                      );
                    }}
                  </Widget>
                </div>

                {showPlaceholder && (
                  <div
                    className="h-8 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 my-3 transition-all duration-200"
                    onDragOver={(e) => {
                      e.preventDefault();
                      handleDragOver(e, index + 1);
                    }}
                    onDrop={handleDrop}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Drag and drop placeholder (bottom) */}
          {dragOverIndex === widgets.length && draggedWidget && (
            <div
              className="h-8 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 transition-all duration-200"
              onDrop={handleDrop}
            />
          )}
        </div>

        {isEditMode && availableWidgets.length > 0 && (
          <div className="border-t p-3 bg-background sticky bottom-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                Add widget to dashboard
              </h4>
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
                {availableWidgets.map((widget) => (
                  <div key={widget.type} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{widget.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddWidget(widget.type, "top")}
                      title="Add to top"
                    >
                      <ListStart className="mr-1 h-4 w-4" /> Top
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddWidget(widget.type, "bottom")}
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
      </SheetContent>

      {commentsDialog && (
        <CommentsDialog
          isOpen={true}
          onClose={() => setCommentsDialog(null)}
          {...commentsDialog}
        />
      )}

      {mediaDialogItem &&
        <MediaDialog
          media={mediaDialogItem}
          onClose={() => setMediaDialogItem(null)}
        />
      }
    </Sheet>
  );
}
