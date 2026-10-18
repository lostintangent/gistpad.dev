import { format as formatDate, formatDistanceToNow } from "date-fns";

/** How long ago a date was (e.g. "5 minutes ago", or "1 year ago", without date-fns' "about"). */
export const timeAgo = (date: Parameters<typeof formatDistanceToNow>[0]) =>
  formatDistanceToNow(date, { addSuffix: true }).replace(/^about /, "");

// Gists can be organized as a series of dated files (e.g. a journal, with a file per day), and
// so these helpers detect when a gist's files are named with a common date format.

type DateFormat = "YYYY-MM-DD" | "MM-DD-YYYY" | "YYYY-MM" | "YYYY";

const DATE_FORMATS: Record<DateFormat, { pattern: RegExp; template: string }> = {
  "YYYY-MM-DD": {
    pattern: /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/,
    template: "yyyy-MM-dd",
  },
  "MM-DD-YYYY": {
    pattern: /^(?<month>\d{2})-(?<day>\d{2})-(?<year>\d{4})$/,
    template: "MM-dd-yyyy",
  },
  "YYYY-MM": { pattern: /^(?<year>\d{4})-(?<month>\d{2})$/, template: "yyyy-MM" },
  YYYY: { pattern: /^(?<year>\d{4})$/, template: "yyyy" },
};

/** Parses a (markdown) filename as a date in the given format, if it's a valid date. */
export function parseDateFilename(filename: string, format: DateFormat) {
  const parts = filename.replace(/\.md$/, "").match(DATE_FORMATS[format].pattern)?.groups;
  if (!parts) return null;

  const year = Number(parts.year);
  const month = Number(parts.month ?? 1);
  const day = Number(parts.day ?? 1);
  const date = new Date(year, month - 1, day);

  // Invalid dates (e.g. 02-30-2025) roll over into the next month
  const isValid = date.getMonth() === month - 1 && date.getDate() === day;
  return isValid ? { year, month, day, date } : null;
}

/** The date format that all of the (non-README) files are named with, if there is one. */
export function detectDateFormat(filenames: string[]) {
  const names = filenames.filter((filename) => filename.toLowerCase() !== "readme.md");
  if (names.length === 0) return null;

  const formats = Object.keys(DATE_FORMATS) as DateFormat[];
  return formats.find((format) => names.every((name) => parseDateFilename(name, format))) ?? null;
}

/** Groups dated files by year and month (with the most recent files first). */
export function groupFilesByDate(filenames: string[]) {
  const format = detectDateFormat(filenames);
  if (!format || format === "YYYY") return null;

  const groups: Record<string, Record<string, string[]>> = {};
  const otherFiles: string[] = [];

  for (const filename of filenames) {
    const parsed = parseDateFilename(filename, format);
    if (!parsed) {
      otherFiles.push(filename);
      continue;
    }

    const month = String(parsed.month).padStart(2, "0");
    ((groups[parsed.year] ??= {})[month] ??= []).push(filename);
  }

  for (const months of Object.values(groups)) {
    for (const files of Object.values(months)) files.sort().reverse();
  }

  return { groups, otherFiles };
}

export function getMostRecentDatedFilename(filenames: string[]) {
  const format = detectDateFormat(filenames);
  if (!format) return null;

  let latest: { filename: string; date: Date } | null = null;
  for (const filename of filenames) {
    const parsed = parseDateFilename(filename, format);
    if (parsed && (!latest || parsed.date > latest.date)) latest = { filename, date: parsed.date };
  }

  return latest?.filename ?? null;
}

/** The (extension-less) filename for today's date, in the given format. */
export function generateDateFilename(format: DateFormat) {
  return formatDate(new Date(), DATE_FORMATS[format].template);
}
