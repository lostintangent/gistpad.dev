import type { ComponentType } from "react";

/** A widget on the user's dashboard (which is persisted in localStorage). */
export interface WidgetState {
  id: string;
  type: string;
  collapsed?: boolean;
  config?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each widget has its own data
export interface WidgetDefinition<T = any> {
  name: string;
  config?: {
    id: string;
    name: string;
    options?: string[];
    default?: string | number | boolean;
    minValue?: number;
    maxValue?: number;
  }[];
  fetchData: (config: Record<string, string>) => Promise<T>;
  component: ComponentType<WidgetProps<T>>;
  staleTime?: number;
  getExternalUrl?: (config: Record<string, string>) => string;
}

/** The props that each widget's component receives (whose data is undefined while it's loading). */
export interface WidgetProps<T> {
  data: T | undefined;
  config: Record<string, string>;
}
