import type { ComponentType } from "react";

export interface Comment {
  id: string;
  user: {
    name: string;
    url: string;
    avatar?: string;
  };
  date: Date;
  text?: string;
  url?: string;
  points?: number;
  replies?: Comment[];
}

export type MediaItem =
  | {
      type: "image";
      url: string;
    }
  | {
      type: "video";
      url: string;
      posterUrl?: string;
      audioUrl?: string;
    }
  | {
      type: "embed";
      src: string;
    };

export interface WidgetDefinitionConfigSetting {
  id: string;
  name: string;
  options?: string[];
  default?: string | number | boolean;
  minValue?: number;
  maxValue?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each widget has its own data
export interface WidgetDefinition<T = any> {
  name: string;
  config?: WidgetDefinitionConfigSetting[];
  fetchData: (config?: Record<string, string>) => Promise<T>;
  component: ComponentType<WidgetProps<T>>;
  staleTime?: number;
  /** Shown when the widget has no data (or nothing is shown, when it's null). */
  emptyStateMessage?: string | null;
  checkEmpty?: (data: T | undefined) => boolean;
  getExternalUrl?: (config?: Record<string, string>) => string;
}

// These are the props that each widget component receives when rendered
export interface WidgetProps<T> {
  data: T | undefined;
  isLoading: boolean;
  config: Record<string, string>;
  openCommentsDialog: (config: {
    title: string;
    text?: string;
    queryKey: unknown[];
    fetchComments: () => Promise<Comment[]>;
  }) => void;
  displayMediaDialog: (media: string | MediaItem | MediaItem[]) => void;
}
