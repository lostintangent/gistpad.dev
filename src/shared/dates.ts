import { formatDistanceToNow } from "date-fns";

/** How long ago a date was (e.g. "5 minutes ago", or "1 year ago", without date-fns' "about"). */
export const timeAgo = (date: Parameters<typeof formatDistanceToNow>[0]) =>
  formatDistanceToNow(date, { addSuffix: true }).replace(/^about /, "");
