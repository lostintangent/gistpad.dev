// A widget's content is indented under its title (by `--widget-indent`, which `Widget` sets). A
// list's markers (e.g. Hacker News' story numbers) start at the tip of the widget's chevron (which
// is 0.75rem in, past the header's padding and half of the chevron), so they hang into that indent.

export const HANGING_LIST = "-ml-[calc(var(--widget-indent)-0.75rem)]";
export const HANGING_MARKER = "w-6 shrink-0";
