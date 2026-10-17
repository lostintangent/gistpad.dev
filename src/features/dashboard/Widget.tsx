import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Slider } from "@/shared/ui/slider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Pencil, RefreshCw, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  getRequiredOptions,
  getWidgetTitle,
  isConfigured,
  widgetRegistry,
  type WidgetState,
} from "./registry";
import type { WidgetDefinition, WidgetProps as WidgetComponentProps } from "./types";

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

        const missingOption = getRequiredOptions(definition).find(
          (option) => !pendingConfig[option.id]?.trim(),
        );
        setError(
          missingOption ? `${missingOption.name} is required` : (onSave(pendingConfig) ?? null),
        );
      }}
    >
      {options.map((option) => {
        const inputId = `${id}-${option.id}`;
        const isRequired = option.default === undefined;
        const isRange = option.minValue !== undefined || option.maxValue !== undefined;

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
              {isRequired && <span className="text-red-500 ml-1">*</span>}
              {isRange && (
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
            ) : isRange ? (
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
            ) : (
              <Input
                id={inputId}
                value={pendingConfig[option.id]}
                onChange={(e) => setValue(option.id, e.target.value)}
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

const headerButtonClass =
  "hover:bg-muted rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent";

interface WidgetProps extends Pick<
  WidgetComponentProps<unknown>,
  "openCommentsDialog" | "displayMediaDialog"
> {
  widget: WidgetState;
  /** Whether the dashboard is in edit mode (where widgets can be configured, moved and removed). */
  isEditMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEnterEditMode: () => void;
  onExitEditMode: () => void;
  onToggleCollapsed: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  /** Returns an error message, if the config can't be saved (e.g. it duplicates another widget). */
  onSaveConfig: (config: Record<string, string>) => string | void;
}

export function Widget({
  widget,
  isEditMode,
  isFirst,
  isLast,
  onEnterEditMode,
  onExitEditMode,
  onToggleCollapsed,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSaveConfig,
  openCommentsDialog,
  displayMediaDialog,
}: WidgetProps) {
  const queryClient = useQueryClient();
  const definition = widgetRegistry[widget.type];
  const title = getWidgetTitle(widget);
  const { collapsed, config = {} } = widget;
  const isReady = isConfigured(definition, config);
  const canEditConfig = !!definition.config?.length && Object.keys(config).length > 0;

  // Long-pressing a widget edits its config, which then exits edit mode once the user is done.
  const [configEdit, setConfigEdit] = useState<{ exitsEditMode: boolean } | null>(null);
  if (configEdit && !isEditMode) setConfigEdit(null);

  const finishEditingConfig = () => {
    setConfigEdit(null);
    if (configEdit?.exitsEditMode) onExitEditMode();
  };

  const longPress = useLongPress(() => {
    if (isEditMode) return onExitEditMode();

    onEnterEditMode();
    if (canEditConfig) {
      if (collapsed) onToggleCollapsed();
      setConfigEdit({ exitsEditMode: true });
    }
  }, onToggleCollapsed);

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

  return (
    <div className="border rounded-lg [.edit-mode_&]:border-dashed [.edit-mode_&]:border-primary/50">
      <div
        className={`flex items-center bg-muted/30 hover:bg-muted/60 transition-colors select-none ${!collapsed ? "border-b border-border [.edit-mode_&]:border-dashed [.edit-mode_&]:border-primary/50" : ""}`}
      >
        <button {...longPress} className="flex-1 p-3 text-left">
          <h3 className="text-lg font-semibold">{title}</h3>
        </button>
        <div className="flex items-center pr-3">
          {isEditMode ? (
            <>
              {canEditConfig && (
                <>
                  <button
                    onClick={() => setConfigEdit({ exitsEditMode: false })}
                    className={headerButtonClass}
                    title="Edit configuration"
                    disabled={!!configEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <div className="mx-1 h-4 border-l" />
                </>
              )}
              <button
                onClick={onMoveUp}
                className={headerButtonClass}
                title="Move up"
                disabled={isFirst}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onMoveDown}
                className={headerButtonClass}
                title="Move down"
                disabled={isLast}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-4 border-l" />
              <button
                onClick={onRemove}
                className={headerButtonClass}
                title={`Remove ${title.toLowerCase()}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              {definition.getExternalUrl && (
                <>
                  <button
                    onClick={() =>
                      window.open(
                        definition.getExternalUrl!(config),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className={headerButtonClass}
                    title="Open external website"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <div className="mx-2 h-4 border-l" />
                </>
              )}
              <button
                // (Resetting the query shows its loading state, unlike a background refetch)
                onClick={() => queryClient.resetQueries({ queryKey, exact: true })}
                className={headerButtonClass}
                title={`Refresh ${title.toLowerCase()}`}
                disabled={isFetching || !isReady}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            </>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="p-3 relative">
          {!isReady || configEdit ? (
            <WidgetConfigForm
              definition={definition}
              config={config}
              onSave={(config) => {
                const error = onSaveConfig(config);
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
            definition.emptyStateMessage !== null && (
              <div className="text-muted-foreground text-sm">
                {definition.emptyStateMessage ?? "No data available"}
              </div>
            )
          ) : (
            <definition.component
              data={data}
              config={config}
              openCommentsDialog={openCommentsDialog}
              displayMediaDialog={displayMediaDialog}
            />
          )}
          {isEditMode && !configEdit && isReady && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[0.5px] rounded-b-lg" />
          )}
        </div>
      )}
    </div>
  );
}
