import type { ComponentType } from "react";

export interface Comment {
  id: string;
  user: { name: string; url: string };
  date: Date;
  text?: string;
  url: string;
  replies: Comment[];
}

/** An item whose comments can be shown in the comments dialog (e.g. a Hacker News story). */
export interface CommentThread {
  title: string;
  text?: string;
  queryKey: unknown[];
  fetchComments: () => Promise<Comment[]>;
}

export type Media =
  { type: "image"; url: string } | { type: "video"; url: string; posterUrl?: string };

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
  /** Shown when the widget has no data (or nothing is shown, when it's null). */
  emptyStateMessage?: string | null;
  getExternalUrl?: (config: Record<string, string>) => string;
}

// These are the props that each widget component receives when rendered
export interface WidgetProps<T> {
  data: T | undefined;
  config: Record<string, string>;
  openCommentsDialog: (thread: CommentThread) => void;
  displayMediaDialog: (media: Media) => void;
}
