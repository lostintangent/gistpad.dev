import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useDocument } from "@/features/editor/document";
import { useOpenDailyTemplate } from "../actions";
import { TEMPLATE_FILENAME, type Gist } from "@/shared/github";
import { useQuery } from "@tanstack/react-query";
import { parse, startOfToday } from "date-fns";
import { gistQueries } from "../queries";
import { Calendar, CheckSquare, FileText, Trash2 } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { GistRow } from "./GistLink";
import { deleteGistDialog } from "../dialogs/DeleteGistDialog";

function getDailyTaskStats(gist: Gist) {
  return Object.values(gist.files)
    .map(({ filename, content = "" }) => {
      // Markdown task syntax: - [ ] or - [x]
      const totalTasks = content.match(/- \[[ x]\]/g)?.length ?? 0;
      const completedTasks = content.match(/- \[x\]/g)?.length ?? 0;

      // (e.g. `2025-01-31.md`, where other files, like the template, have an invalid date)
      const date = parse(filename.replace(/\.md$/, ""), "yyyy-MM-dd", new Date());

      return {
        filename,
        totalTasks,
        completedTasks,
        time: date.getTime() || 0,
        // Whether the note is from a previous day, and still has incomplete tasks
        isPastDueWithTasks: date < startOfToday() && completedTasks < totalTasks,
      };
    })
    .sort(
      (a, b) =>
        // Past-due notes first, and then newest first
        Number(b.isPastDueWithTasks) - Number(a.isPastDueWithTasks) || b.time - a.time,
    );
}

const OVERDUE_BADGE_CLASSES =
  "ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 py-0.5 px-1.5 rounded-full";

export function DailyNotes({ dailyNotes }: { dailyNotes: Gist }) {
  const { gistId: openGistId, filename: openFilename } = useDocument();
  // The gist list doesn't include file contents, so load the full gist to count its tasks.
  const { data: taskStats = [] } = useQuery({
    ...gistQueries.detail(dailyNotes.id),
    select: getDailyTaskStats,
  });
  const openTemplate = useOpenDailyTemplate();

  const filenames = Object.keys(dailyNotes.files).filter((name) => name !== TEMPLATE_FILENAME);
  if (filenames.length === 0) return null;

  // Past-due notes (with incomplete tasks) come first, followed by the newest notes.
  const sortedFilenames = [
    ...taskStats.map(({ filename }) => filename).filter((name) => filenames.includes(name)),
    ...filenames.filter((name) => !taskStats.some((stats) => stats.filename === name)),
  ];

  const overdueTaskCount = taskStats
    .filter((stats) => stats.isPastDueWithTasks)
    .reduce((total, stats) => total + stats.totalTasks - stats.completedTasks, 0);

  return (
    <CollapsibleSection
      section="daily"
      title={
        <>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          Daily notes
        </>
      }
      count={filenames.length}
      collapsedDetails={
        overdueTaskCount > 0 && (
          <span className={OVERDUE_BADGE_CLASSES}>{overdueTaskCount} overdue</span>
        )
      }
      actions={
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => openTemplate(dailyNotes)}
          title="Edit template"
        >
          <FileText />
        </Button>
      }
      openGistId={openGistId === dailyNotes.id ? openGistId : undefined}
      rowCount={filenames.length}
    >
      <ScrollArea className="h-full">
        <div className="py-1 pl-3 pr-2 space-y-0.5">
          {sortedFilenames.map((filename) => {
            const stats = taskStats.find((stats) => stats.filename === filename);
            const isSelected = openGistId === dailyNotes.id && openFilename === filename;

            return (
              <GistRow
                key={filename}
                gistId={dailyNotes.id}
                filename={filename}
                isSelected={isSelected}
                className="py-1.5 px-2"
                action={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => deleteGistDialog.openWithPayload({ gist: dailyNotes, filename })}
                    title="Delete daily note"
                  >
                    <Trash2 className="text-red-500" />
                  </Button>
                }
              >
                <div className="flex justify-between items-center text-sm">
                  <span
                    className={`truncate ${stats?.isPastDueWithTasks ? "text-amber-700 dark:text-amber-400" : ""}`}
                  >
                    {filename.replace(/\.md$/, "")}
                    {stats?.isPastDueWithTasks && (
                      <span className={OVERDUE_BADGE_CLASSES}>overdue</span>
                    )}
                  </span>
                  {stats && stats.totalTasks > 0 && (
                    <span
                      className={`text-xs flex items-center gap-1 ${
                        stats.isPastDueWithTasks
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <CheckSquare className="h-3 w-3" />
                      {stats.completedTasks}/{stats.totalTasks}
                    </span>
                  )}
                </div>
              </GistRow>
            );
          })}
        </div>
      </ScrollArea>
    </CollapsibleSection>
  );
}
