import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { Slider } from "@/shared/ui/slider";
import { queryClient } from "@/shared/query-client";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Pencil,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useId, useRef, useState } from "react";
import { getWidgetTitle, isConfigured, widgetRegistry } from "./registry";
import { configureWidget, moveWidget, removeWidget, updateWidget } from "./store";
import type { WidgetDefinition, WidgetState } from "./types";

const LONG_PRESS_DELAY = 500;

/** Calls `onLongPress` when the element is pressed and held, and otherwise, calls `onClick`. */
function useLongPress(onLongPress: () => void, onClick: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const didLongPress = useRef(false);
  const cancel = () => clearTimeout(timer.current);

  return {
    onPointerDown: () => {
      didLongPress.current = false;
      timer.current = setTimeout(() => {
        didLongPress.current = true;
        onLongPress();
      }, LONG_PRESS_DELAY);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick: () => {
      if (!didLongPress.current) onClick();
    },
  };
}

/** Edits a widget's config, which is mounted while editing (so it starts from the saved config). */
function WidgetConfigForm({
  definition,
  config,
  onSave,
  onCancel,
}: {
  definition: WidgetDefinition;
  config: Record<string, string>;
  /** Returns an error message, if the config can't be saved. */
  onSave: (config: Record<string, string>) => string | void;
  onCancel?: () => void;
}) {
  const id = useId();
  const options = definition.config ?? [];
  const [pendingConfig, setPendingConfig] = useState(() => ({
    ...Object.fromEntries(
      options.map((option) => [
        option.id,
        option.default === undefined ? (option.options?.[0] ?? "") : String(option.default),
      ]),
    ),
    ...config,
  }));
  const [error, setError] = useState<string | null>(null);

  const setValue = (optionId: string, value: string) =>
    setPendingConfig((config) => ({ ...config, [optionId]: value }));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(onSave(pendingConfig) ?? null);
      }}
    >
      {options.map((option) => {
        const inputId = `${id}-${option.id}`;

        if (typeof option.default === "boolean") {
          return (
            <div key={option.id} className="flex items-center gap-2">
              <Label htmlFor={inputId} className="text-sm font-medium cursor-pointer">
                {option.name}
              </Label>
              <Checkbox
                id={inputId}
                checked={pendingConfig[option.id] === "true"}
                onCheckedChange={(checked) => setValue(option.id, String(checked))}
              />
            </div>
          );
        }

        return (
          <div key={option.id} className="flex items-center gap-3">
            <Label htmlFor={inputId} className="text-sm font-medium min-w-24 shrink-0">
              {option.name}
              {!option.options && (
                <span className="text-muted-foreground ml-1">({pendingConfig[option.id]})</span>
              )}
            </Label>
            {option.options ? (
              <Select
                value={pendingConfig[option.id]}
                onValueChange={(value) => setValue(option.id, value ?? "")}
              >
                <SelectTrigger id={inputId} className="flex-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {option.options.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Slider
                id={inputId}
                min={option.minValue || 1}
                max={option.maxValue}
                step={1}
                value={[Number(pendingConfig[option.id]) || (option.minValue ?? 1)]}
                onValueChange={(values) =>
                  setValue(option.id, String(Array.isArray(values) ? values[0] : values))
                }
                className="flex-1"
              />
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

interface WidgetAction {
  Icon: LucideIcon;
  title: string;
  run: () => void;
  disabled?: boolean;
  /** Whether the action is in progress (e.g. refreshing), which spins its icon. */
  isBusy?: boolean;
}

interface WidgetProps {
  widget: WidgetState;
  /** The widget's position on the dashboard (which it can be moved up or down from). */
  index: number;
  isLast: boolean;
  /** Whether the dashboard is in edit mode (where widgets can be configured, moved and removed). */
  isEditMode: boolean;
  onEditModeChange: (isEditMode: boolean) => void;
}

export function Widget({ widget, index, isLast, isEditMode, onEditModeChange }: WidgetProps) {
  const definition = widgetRegistry[widget.type];
  const title = getWidgetTitle(widget);
  const { id, collapsed, config = {} } = widget;
  const toggleCollapsed = () => updateWidget(id, { collapsed: !collapsed });
  const isReady = isConfigured(definition, config);
  const canEditConfig = !!definition.config?.length && Object.keys(config).length > 0;

  // Long-pressing a widget edits its config, which then exits edit mode once the user is done.
  const [configEdit, setConfigEdit] = useState<{ exitsEditMode: boolean } | null>(null);
  if (configEdit && !isEditMode) setConfigEdit(null);

  const finishEditingConfig = () => {
    setConfigEdit(null);
    if (configEdit?.exitsEditMode) onEditModeChange(false);
  };

  const longPress = useLongPress(() => {
    if (isEditMode) return onEditModeChange(false);

    onEditModeChange(true);
    if (canEditConfig) {
      if (collapsed) toggleCollapsed();
      setConfigEdit({ exitsEditMode: true });
    }
  }, toggleCollapsed);

  const queryKey = ["widgets", widget.type, config];
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => definition.fetchData(config),
    staleTime: definition.staleTime ?? 1000 * 60 * 5,
    retry: 1,
    enabled: isReady,
    // Widget data is short-lived, and can be large (e.g. ESPN's articles)
    meta: { persist: false },
  });

  const isEmpty = !data || (Array.isArray(data) && data.length === 0);

  const { getExternalUrl } = definition;
  const lowerTitle = title.toLowerCase();
  const editConfig: WidgetAction = {
    Icon: Pencil,
    title: "Edit configuration",
    run: () => setConfigEdit({ exitsEditMode: false }),
    disabled: !!configEdit,
  };
  const moveUp: WidgetAction = {
    Icon: ChevronUp,
    title: "Move up",
    run: () => moveWidget(id, index - 1),
    disabled: index === 0,
  };
  const moveDown: WidgetAction = {
    Icon: ChevronDown,
    title: "Move down",
    run: () => moveWidget(id, index + 1),
    disabled: isLast,
  };
  const remove: WidgetAction = {
    Icon: X,
    title: `Remove ${lowerTitle}`,
    run: () => removeWidget(id),
  };
  const openWebsite: WidgetAction = {
    Icon: ExternalLink,
    title: "Open external website",
    run: () => window.open(getExternalUrl!(config), "_blank", "noopener,noreferrer"),
  };
  const refresh: WidgetAction = {
    Icon: RefreshCw,
    title: `Refresh ${lowerTitle}`,
    // (Resetting the query shows its loading state, unlike a background refetch)
    run: () => queryClient.resetQueries({ queryKey, exact: true }),
    disabled: isFetching || !isReady,
    isBusy: isFetching,
  };

  const actionGroups = (
    isEditMode
      ? [canEditConfig && [editConfig], [moveUp, moveDown], [remove]]
      : [getExternalUrl && [openWebsite], [refresh]]
  ).filter((group) => !!group);

  return (
    // Widgets sit directly on the dashboard (like the gist list on the sidebar), and are only
    // outlined in edit mode (where they can be moved)
    <div className="rounded-lg [.edit-mode_&]:border [.edit-mode_&]:border-dashed [.edit-mode_&]:border-primary/50">
      <div className="flex items-center rounded-lg hover:bg-foreground/5 transition-colors select-none">
        {/* (Like the sidebar's sections, whose content is indented under their header) */}
        <button {...longPress} className="flex-1 flex items-center gap-2 px-1 py-1.5 text-left">
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "" : "rotate-90"}`}
          />
          <h3 className="font-semibold">{title}</h3>
        </button>
        <div className="flex items-center pr-1">
          {actionGroups.map((group, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <Separator
                  orientation="vertical"
                  className="mx-1 h-4 data-vertical:self-center bg-separator"
                />
              )}
              {group.map(({ Icon, title, run, disabled, isBusy }) => (
                <Button
                  key={title}
                  variant="ghost"
                  size="icon-xs"
                  title={title}
                  onClick={run}
                  disabled={disabled}
                >
                  <Icon className={isBusy ? "animate-spin" : undefined} />
                </Button>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      {!collapsed && (
        // (Its content is indented under its title, like the sidebar's sections; see `HackerNews`)
        <div className="[--widget-indent:--spacing(5)] pl-(--widget-indent) pr-2 pt-1 pb-2 relative">
          {!isReady || configEdit ? (
            <WidgetConfigForm
              definition={definition}
              config={config}
              onSave={(config) => {
                const error = configureWidget(widget, config);
                if (!error) finishEditingConfig();
                return error;
              }}
              onCancel={configEdit ? finishEditingConfig : undefined}
            />
          ) : error ? (
            <div className="text-red-500 text-sm">
              Error: {error.message || "Failed to load data"}
            </div>
          ) : !isLoading && isEmpty ? (
            <div className="text-muted-foreground text-sm">No data available</div>
          ) : (
            <definition.component data={data} config={config} />
          )}
          {isEditMode && !configEdit && isReady && (
            <div className="absolute inset-0 bg-backdrop/50 backdrop-blur-[0.5px] rounded-b-lg" />
          )}
        </div>
      )}
    </div>
  );
}
