import type { Command } from "./command";

/** A page of commands that the palette can open (e.g. a file's revisions), which the workbench composes. */
export interface CommandPage {
  id: string;
  title: string;
  group?: string;
  icon?: Command["icon"];
  commands: readonly Command[];
  /** Loads the page's commands (e.g. by fetching them), when the page is opened. */
  load?: () => void;
  isLoading?: boolean;
}

/** What the palette lists: a command, or a page of them. */
export type SearchMatch = Command | CommandPage;

const GROUP_ORDER = [
  "Recent",
  "Gists",
  "Files",
  "Agent",
  "This gist",
  "View",
  "Settings",
  "Account",
];

/** The commands that match a query, in the palette's order: by group, with the titles that start with the query first. */
export function matchCommands<T extends Pick<Command, "title" | "group">>(
  commands: readonly T[],
  query: string,
): T[] {
  const text = query.trim().toLowerCase();
  const rank = (command: T) => {
    const title = command.title.toLowerCase();
    if (!text || title.startsWith(text)) return 0;
    if (title.includes(text)) return 1;
    return command.group?.toLowerCase().includes(text) ? 2 : -1;
  };
  const groupRank = (group: string | undefined) => {
    const index = GROUP_ORDER.indexOf(group ?? "");
    return index < 0 ? GROUP_ORDER.length : index;
  };

  return commands
    .filter((command) => rank(command) >= 0)
    .sort(
      (a, b) =>
        groupRank(a.group) - groupRank(b.group) ||
        (a.group ?? "").localeCompare(b.group ?? "") ||
        rank(a) - rank(b),
    );
}

/**
 * The matches for a query across the registered commands and the pages. While browsing, a page
 * stands in for its commands (and the commands marked `searchOnly` are left out); and when there's
 * a query, the commands that take text (e.g. "New gist") are offered it.
 */
export function searchCommands(
  commands: readonly Command[],
  pages: readonly CommandPage[],
  query: string,
): SearchMatch[] {
  const text = query.trim();
  const pageCommands = new Set(pages.flatMap((page) => page.commands.map((command) => command.id)));
  const rootCommands = commands.filter(
    (command) => text || (!pageCommands.has(command.id) && !command.searchOnly),
  );
  const invocations = text
    ? commands
        .filter((command) => command.acceptsInput)
        .map((command): Command => ({
          ...command,
          id: `${command.id}:input`,
          title: `${command.title}: ${text}`,
          run: () => command.run(text),
        }))
    : [];

  return matchCommands<SearchMatch>([...rootCommands, ...pages, ...invocations], text);
}
