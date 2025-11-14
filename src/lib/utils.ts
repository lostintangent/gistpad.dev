import { clsx, type ClassValue } from "clsx";
import { format as formatDate } from "date-fns";
import { twMerge } from "tailwind-merge";
import { parse as parseYaml } from "yaml";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseFrontMatter(content: string) {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) return { frontMatter: null, content: content };

  try {
    const [, frontMatterYaml, remainingContent] = match;
    const frontMatter = parseYaml(frontMatterYaml);
    return {
      frontMatter,
      frontMatterYaml,
      content: remainingContent.trim(),
    };
  } catch (error) {
    console.warn("Error parsing frontmatter:", error);
    return { frontMatter: null, content: content };
  }
}

export function playAiChime() {
  const audio = new Audio("./chime.mp3");
  return audio.play();
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export type DateFormat = "YYYY-MM-DD" | "MM-DD-YYYY" | "YYYY" | "YYYY-MM";

/**
 * Detects if all filenames follow a common date format. Returns the format
 * string if all filenames match either `YYYY-MM-DD` or `MM-DD-YYYY`.
 */
export function detectDateFormat(filenames: string[]): DateFormat | null {
  const patterns: Record<DateFormat, RegExp> = {
    "YYYY-MM-DD": /^(\d{4})-(\d{2})-(\d{2})$/,
    "MM-DD-YYYY": /^(\d{2})-(\d{2})-(\d{4})$/,
    YYYY: /^(\d{4})$/,
    "YYYY-MM": /^(\d{4})-(\d{2})$/,
  };

  const filtered = filenames
    .filter((f) => f.toLowerCase() !== "readme.md")
    .map((f) => f.replace(/\.md$/, ""));

  if (!filtered.length) {
    return null;
  }

  let detected: DateFormat | null = null;

  for (const name of filtered) {
    let matched = false;
    for (const [format, regex] of Object.entries(patterns)) {
      const m = name.match(regex);
      if (m) {
        // Validate the date to avoid accepting invalid numbers
        let year: number, month: number, day: number;
        switch (format) {
          case "YYYY":
            year = parseInt(m[1]);
            matched = !isNaN(year);
            break;
          case "YYYY-MM":
            year = parseInt(m[1]);
            month = parseInt(m[2]);
            const ymDate = new Date(year, month - 1, 1);
            matched =
              ymDate.getFullYear() === year && ymDate.getMonth() === month - 1;
            break;
          case "YYYY-MM-DD":
            year = parseInt(m[1]);
            month = parseInt(m[2]);
            day = parseInt(m[3]);
            const ymdDate = new Date(year, month - 1, day);
            matched =
              ymdDate.getFullYear() === year &&
              ymdDate.getMonth() === month - 1 &&
              ymdDate.getDate() === day;
            break;
          case "MM-DD-YYYY":
            month = parseInt(m[1]);
            day = parseInt(m[2]);
            year = parseInt(m[3]);
            const mdyDate = new Date(year, month - 1, day);
            matched =
              mdyDate.getFullYear() === year &&
              mdyDate.getMonth() === month - 1 &&
              mdyDate.getDate() === day;
            break;
        }
        if (matched) {
          if (!detected) {
            detected = format as DateFormat;
          } else if (detected !== format) {
            return null; // inconsistent formats
          }
          break;
        }
      }
    }

    if (!matched) {
      return null;
    }
  }

  return detected;
}

// TODO: Refactor all of this date logic. I'm only merging this in because
// it's what AI wrote, and I want to dogfood it to see if it's useful.

export function groupFilesByDate(
  filenames: string[]
): {
  groups: Record<string, Record<string, string[]>>;
  otherFiles: string[];
} | null {
  const format = detectDateFormat(filenames);
  if (!format || format === "YYYY") return null;

  const groups: Record<string, Record<string, string[]>> = {};
  const otherFiles: string[] = [];

  for (const filename of filenames) {
    if (filename.toLowerCase() === "readme.md") {
      otherFiles.push(filename);
      continue;
    }
    const base = filename.replace(/\.md$/, "");
    let year: number | null = null;
    let month: number | null = null;
    let match: RegExpMatchArray | null = null;

    switch (format) {
      case "YYYY-MM-DD":
        match = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
        }
        break;
      case "MM-DD-YYYY":
        match = base.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (match) {
          month = parseInt(match[1]);
          year = parseInt(match[3]);
        }
        break;
      case "YYYY-MM":
        match = base.match(/^(\d{4})-(\d{2})$/);
        if (match) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
        }
        break;
    }

    if (match && year !== null && month !== null) {
      const yearKey = year.toString();
      const monthKey = month.toString().padStart(2, "0");
      groups[yearKey] = groups[yearKey] || {};
      groups[yearKey][monthKey] = groups[yearKey][monthKey] || [];
      groups[yearKey][monthKey].push(filename);
    } else {
      otherFiles.push(filename);
    }
  }

  // Sort groups and files in descending order
  for (const year of Object.keys(groups)) {
    for (const month of Object.keys(groups[year])) {
      groups[year][month].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    }
  }
  return { groups, otherFiles };
}

export function generateDateFilename(
  format: DateFormat,
  date: Date = new Date()
): string {
  let fmt: string;
  switch (format) {
    case "YYYY":
      fmt = "yyyy";
      break;
    case "YYYY-MM":
      fmt = "yyyy-MM";
      break;
    case "YYYY-MM-DD":
      fmt = "yyyy-MM-dd";
      break;
    case "MM-DD-YYYY":
    default:
      fmt = "MM-dd-yyyy";
      break;
  }
  return `${formatDate(date, fmt)}`;
}

export function isDateBasedGist(gist: {
  files: Record<string, { filename: string }>;
}): boolean {
  const filenames = Object.keys(gist.files).filter((f) => f.endsWith(".md"));
  return detectDateFormat(filenames) !== null;
}

export function getMostRecentDatedFilename(filenames: string[]): string | null {
  const format = detectDateFormat(filenames);
  if (!format) return null;

  let latest: { file: string; date: Date } | null = null;

  for (const filename of filenames) {
    if (filename.toLowerCase() === "readme.md") continue;
    const base = filename.replace(/\.md$/, "");
    let year: number,
      month = 1,
      day = 1;
    let match: RegExpMatchArray | null = null;
    switch (format) {
      case "YYYY":
        match = base.match(/^(\d{4})$/);
        if (match) {
          year = parseInt(match[1]);
        } else continue;
        break;
      case "YYYY-MM":
        match = base.match(/^(\d{4})-(\d{2})$/);
        if (match) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
        } else continue;
        break;
      case "YYYY-MM-DD":
        match = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else continue;
        break;
      case "MM-DD-YYYY":
        match = base.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (match) {
          month = parseInt(match[1]);
          day = parseInt(match[2]);
          year = parseInt(match[3]);
        } else continue;
        break;
    }

    const date = new Date(year, month - 1, day);
    if (!latest || date > latest.date) {
      latest = { file: filename, date };
    }
  }

  return latest ? latest.file : null;
}

export function evaluateMathExpression(
  expr: string,
  previousResult: string | null = null,
  variables: Map<string, string> = new Map()
): string | null {
  if (previousResult !== null) {
    expr = expr.replace(/_/g, previousResult);
  }

  for (const [varName, value] of variables.entries()) {
    try {
      expr = expr.replace(new RegExp(`\\$?${varName}`, "gi"), value);
    } catch {
      // ignore invalid regex
    }
  }

  let containsDollar = false;
  let containsMagnitude = false;

  // Replace numbers that may include commas, a leading $, and/or trailing k or M
  const normalized = expr.replace(/\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)([km])?/gi, (match, num, suffix) => {
    if (match.startsWith("$")) {
      containsDollar = true;
    }
    if (suffix) {
      containsMagnitude = true;
    }

    const n = parseFloat(num.replace(/,/g, ""));
    if (isNaN(n)) {
      return match;
    }

    const multiplier =
      suffix?.toLowerCase() === "k" ? 1000 : suffix?.toLowerCase() === "m" ? 1_000_000 : 1;
    return (n * multiplier).toString();
  });

  // Only allow numbers, operators and parentheses after normalization
  if (!/^[-+*/().\d\s]+$/.test(normalized)) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${normalized})`)();
    if (typeof result === "number" && isFinite(result)) {
      const options: Intl.NumberFormatOptions = {};
      if (containsDollar) {
        options.style = "currency";
        options.currency = "USD";
      }
      if (containsMagnitude) {
        options.notation = "compact";
      }

      return new Intl.NumberFormat(undefined, options).format(result);
    }
  } catch {
    // ignore
  }
  return null;
}

export function extractVariableAssignments(text: string): Map<string, string> {
  const assignments = new Map<string, string>();
  const lineOnlyAssignment = /^(?:\s*[-*]\s+)?(?:[^:]+:=\s*\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[km]?\s*)+$/i;
  if (!lineOnlyAssignment.test(text.trim())) {
    return assignments;
  }

  const cleaned = text.replace(/^\s*[-*]\s+/, "");
  const regex = /([^:]+):=\s*(\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[km]?)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned))) {
    const name = match[1].trim();
    const value = evaluateMathExpression(match[2], null, new Map());
    if (value !== null) {
      assignments.set(name, value);
      assignments.set(name.replace(/\s+/g, "-"), value);
    }
  }

  return assignments;
}
