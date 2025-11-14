import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Pencil, RefreshCw, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import TagBadge from "@/components/list/TagBadge";
import { WidgetBadge, WidgetDefinitionConfigSetting } from "./types";

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

interface WidgetProps<T> {
  title: string;
  fetcher: (config?: Record<string, string>) => Promise<T>;
  children: (
    data: T | undefined,
    isLoading: boolean,
    config?: Record<string, string>
  ) => ReactNode;
  staleTime?: number;
  onRemove?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  configOptions?: WidgetDefinitionConfigSetting[];
  config?: Record<string, string>;
  onSaveConfig?: (config: Record<string, string>) => string | void;
  onCancelConfig?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  position?: { index: number; total: number };
  isEditingConfig?: boolean;
  onEditConfigChange?: (editing: boolean) => void;
  onEnterEditMode?: () => void;
  onExitEditMode?: () => void;
  emptyStateMessage?: string | null; // null means return null, undefined means default behavior
  checkEmpty?: (data: T | undefined) => boolean;
  getExternalUrl?: (config?: Record<string, string>) => string;
  getBadge?: (
    config?: Record<string, string>
  ) => Promise<WidgetBadge | undefined>;
}

export function Widget<T>({
  title,
  fetcher,
  children,
  staleTime,
  onRemove,
  collapsed = false,
  onToggleCollapsed,
  configOptions,
  config,
  onSaveConfig,
  onCancelConfig,
  onMoveUp,
  onMoveDown,
  position,
  isEditingConfig: externalIsEditingConfig,
  onEditConfigChange,
  onEnterEditMode,
  onExitEditMode,
  emptyStateMessage,
  checkEmpty,
  getExternalUrl,
  getBadge,
}: WidgetProps<T>) {
  // Transform title once for both keys (lowercase, spaces to hyphens)
  const titleKey = title.toLowerCase().replace(/\s+/g, "-").replace(/[\(\)]/g, "");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInEditMode, setIsInEditMode] = useState(false);
  const [internalIsEditingConfig, setInternalIsEditingConfig] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  // Shared callbacks for long press functionality
  const handleLongPressStart = () => {
    // Don't start a new long press if one was already triggered
    if (longPressTriggered) {
      return;
    }

    setLongPressTriggered(false);
    const timer = setTimeout(() => {
      setLongPressTriggered(true);

      // Toggle edit mode - if already in edit mode, exit it; otherwise enter it
      if (isInEditMode) {
        onExitEditMode?.();
      } else {
        onEnterEditMode?.();

        // Only trigger config mode if widget has config options and existing config
        if (configOptions && configOptions.length > 0 && hasConfig) {
          // Expand the widget if it's collapsed before entering config mode
          if (collapsed) {
            onToggleCollapsed?.();
          }

          setTimeout(() => {
            setIsEditingConfig(true);
            setPendingConfig(config || {});
            setConfigError(null);
          }, 100);
        }
      }

      // Clear the timer after triggering to prevent re-triggering
      setLongPressTimer(null);
    }, 500); // 500ms for long press
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // Reset the triggered flag after a delay to allow for new long presses
    if (longPressTriggered) {
      setTimeout(() => {
        setLongPressTriggered(false);
      }, 200);
    }
  };

  // Use external control if provided, otherwise use internal state
  const isEditingConfig =
    externalIsEditingConfig !== undefined
      ? externalIsEditingConfig
      : internalIsEditingConfig;
  const setIsEditingConfig = (value: boolean) => {
    if (onEditConfigChange) {
      onEditConfigChange(value);
    } else {
      setInternalIsEditingConfig(value);
    }
  };
  const [pendingConfig, setPendingConfig] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      if (config && Object.keys(config).length > 0) {
        // If config exists, use it as initial values
        return { ...config };
      }
      // Otherwise use defaults
      configOptions?.forEach((opt) => {
        if (opt.default !== undefined) {
          initial[opt.id] = String(opt.default);
        } else {
          initial[opt.id] = opt.options?.[0] || "";
        }
      });
      return initial;
    }
  );
  const [configError, setConfigError] = useState<string | null>(null);

  // Only require config for options without default values
  const configOptionsWithoutDefaults =
    configOptions?.filter((opt) => opt.default === undefined) || [];
  const requiresConfig = configOptionsWithoutDefaults.length > 0;

  // Check if all required config options have values
  const hasRequiredConfig = configOptionsWithoutDefaults.every(
    (opt) => config && config[opt.id] && config[opt.id].trim() !== ""
  );

  const hasConfig = !!config && Object.keys(config).length > 0;

  const isFirstWidget = position?.index === 0;
  const isLastWidget = position ? position.index === position.total - 1 : false;

  // Check if ancestor has edit-mode class
  useEffect(() => {
    const checkEditMode = () => {
      const hasEditModeAncestor = !!document.querySelector(".edit-mode");
      setIsInEditMode(hasEditModeAncestor);
      // If exiting edit mode and we're editing config, cancel the edit
      if (!hasEditModeAncestor && isEditingConfig) {
        setIsEditingConfig(false);
        setPendingConfig(config || {});
        setConfigError(null);
      }
    };

    checkEditMode();
    // Use MutationObserver to detect class changes
    const observer = new MutationObserver(checkEditMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });

    return () => observer.disconnect();
  }, [isEditingConfig, config]);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: [titleKey, config],
    queryFn: () => fetcher(config),
    staleTime: staleTime ?? 1000 * 60 * 5, // default 5 minutes
    retry: 1,
    enabled: !requiresConfig || hasRequiredConfig,
  });

  const { data: badge, refetch: refetchBadge } = useQuery<WidgetBadge | undefined>({
    queryKey: [titleKey, "badge", config],
    queryFn: () => getBadge!(config),
    enabled: !!getBadge && !isInEditMode,
    refetchInterval: 60 * 1000,
  });

  // Reset isRefreshing when not refetching
  if (isRefreshing && !isRefetching) {
    setIsRefreshing(false);
  }

  // Combined loading state for child components
  const combinedIsLoading = isLoading || isRefreshing;

  // Check if data is empty using custom checker or default logic
  const isDataEmpty = checkEmpty
    ? checkEmpty(data)
    : !data || (Array.isArray(data) && data.length === 0);

  // Determine what to show for empty state
  const getEmptyStateContent = () => {
    if (emptyStateMessage === null) {
      return null; // Return null (don't render anything)
    }
    if (emptyStateMessage) {
      return (
        <div className="text-muted-foreground text-sm">
          {emptyStateMessage}
        </div>
      );
    }
    // Default empty state message
    return (
      <div className="text-muted-foreground text-sm">
        No data available
      </div>
    );
  };

  return (
    <div className="border rounded-lg [.edit-mode_&]:border-dashed [.edit-mode_&]:border-primary/50">
      <div className="p-3 flex items-center justify-between">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Only toggle collapsed if long press was not triggered
            if (!longPressTriggered) {
              onToggleCollapsed?.();
            }
          }}
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
          className={`flex-1 flex items-center justify-between bg-muted/30 hover:bg-muted/60 transition-colors -m-3 p-3 select-none ${!collapsed ? "border-b border-border [.edit-mode_&]:border-dashed [.edit-mode_&]:border-primary/50" : ""}`}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            {badge &&
              typeof badge.count === "number" &&
              !isInEditMode && (
                <TagBadge
                  tag={formatCount(badge.count)}
                  color={badge.color}
                />
              )}
          </div>
          {isInEditMode ? (
            <div className="flex items-center">
              {configOptions && configOptions.length > 0 && hasConfig && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingConfig(true);
                      // Reset pending config to current values when starting edit
                      setPendingConfig(config || {});
                      setConfigError(null);
                    }}
                    className="hover:bg-muted rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title="Edit configuration"
                    disabled={isEditingConfig}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <div className="mx-1 h-4 border-l" />
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp?.();
                }}
                className="hover:bg-muted rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Move up"
                disabled={isFirstWidget}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown?.();
                }}
                className="hover:bg-muted rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Move down"
                disabled={isLastWidget}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-4 border-l" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.();
                }}
                className="hover:bg-muted rounded p-1 transition-colors"
                title={`Remove ${title.toLowerCase()}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              {getExternalUrl && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = getExternalUrl(config);
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    className="hover:bg-muted rounded p-1 transition-colors"
                    title="Open external website"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <div className="mx-2 h-4 border-l" />
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRefreshing(true);
                  refetch();
                  if (getBadge) {
                    refetchBadge();
                  }
                }}
                className="hover:bg-muted rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Refresh ${title.toLowerCase()}`}
                disabled={
                  combinedIsLoading || (requiresConfig && !hasRequiredConfig)
                }
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${combinedIsLoading || isRefetching ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          )}
        </button>
      </div>
      {!collapsed && (
        <div className="p-3 relative">
          {/* Config form */}
          {(requiresConfig && !hasRequiredConfig) || isEditingConfig ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();

                // Validate required fields
                const missingRequired = configOptionsWithoutDefaults.find(
                  (opt) =>
                    !pendingConfig[opt.id] ||
                    pendingConfig[opt.id].trim() === ""
                );

                if (missingRequired) {
                  setConfigError(`${missingRequired.name} is required`);
                  return;
                }

                const error = onSaveConfig?.(pendingConfig);
                if (error) {
                  setConfigError(error);
                } else {
                  setConfigError(null);
                  setIsEditingConfig(false);

                  setIsRefreshing(true);
                  refetch();
                  if (getBadge) {
                    refetchBadge();
                  }
                }
              }}
            >
              {configOptions?.map((opt) => {
                // Check if this is a boolean-like setting
                const isBooleanLike = opt.id.toLowerCase().startsWith("show") ||
                  opt.id.toLowerCase().startsWith("display") ||
                  opt.id.toLowerCase().startsWith("has") ||
                  opt.id.toLowerCase().startsWith("is");

                return (
                  <div key={opt.id} className={isBooleanLike ? "flex items-center gap-2" : "flex items-center gap-3"}>
                    {isBooleanLike ? (
                      // Checkbox with label side by side
                      <>
                        <Label
                          htmlFor={`${titleKey}-${opt.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {opt.name}
                          {opt.default === undefined && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </Label>
                        <Checkbox
                          id={`${titleKey}-${opt.id}`}
                          checked={pendingConfig[opt.id] === "true"}
                          onCheckedChange={(checked) =>
                            setPendingConfig((prev) => ({ ...prev, [opt.id]: String(checked) }))
                          }
                        />

                      </>
                    ) : (
                      // Regular label for non-checkbox fields
                      <Label
                        htmlFor={`${titleKey}-${opt.id}`}
                        className="text-sm font-medium min-w-24 shrink-0"
                      >
                        {opt.name}
                        {opt.default === undefined && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        {opt.minValue !== undefined &&
                          opt.maxValue !== undefined && (
                            <span className="text-muted-foreground ml-1">
                              ({pendingConfig[opt.id] || opt.default})
                            </span>
                          )}
                      </Label>
                    )}
                    {isBooleanLike ? null : opt.options ? (
                      <Select
                        value={pendingConfig[opt.id]}
                        onValueChange={(v) =>
                          setPendingConfig((prev) => ({ ...prev, [opt.id]: v }))
                        }
                      >
                        <SelectTrigger
                          id={`${titleKey}-${opt.id}`}
                          className="flex-1"
                        >
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {opt.options.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : opt.minValue !== undefined ||
                      opt.maxValue !== undefined ? (
                      <Slider
                        id={`${titleKey}-${opt.id}`}
                        min={opt.minValue || 1}
                        max={opt.maxValue}
                        step={1}
                        value={[
                          parseInt(pendingConfig[opt.id]) ||
                          (typeof opt.default === "number"
                            ? opt.default
                            : opt.minValue),
                        ]}
                        onValueChange={(values) =>
                          setPendingConfig((prev) => ({
                            ...prev,
                            [opt.id]: String(values[0]),
                          }))
                        }
                        className="flex-1"
                      />
                    ) : (
                      <Input
                        id={`${titleKey}-${opt.id}`}
                        value={pendingConfig[opt.id]}
                        onChange={(e) =>
                          setPendingConfig((prev) => ({
                            ...prev,
                            [opt.id]: e.target.value,
                          }))
                        }
                        className="flex-1"
                      />
                    )}
                  </div>
                );
              })}
              {configError && (
                <p className="text-sm text-destructive">{configError}</p>
              )}
              <div className="flex justify-end gap-2">
                {isEditingConfig && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingConfig(false);
                      setPendingConfig(config || {});
                      setConfigError(null);
                      onCancelConfig?.();
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" size="sm">
                  Save
                </Button>
              </div>
            </form>
          ) : error ? (
            <div className="text-red-500 text-sm">
              Error: {error.message || "Failed to load data"}
            </div>
          ) : !combinedIsLoading && isDataEmpty ? (
            getEmptyStateContent()
          ) : (
            children(data, combinedIsLoading, config)
          )}
          {isInEditMode &&
            !isEditingConfig &&
            (!requiresConfig || hasRequiredConfig) && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[0.5px] rounded-b-lg" />
            )}
        </div>
      )}
    </div>
  );
}
