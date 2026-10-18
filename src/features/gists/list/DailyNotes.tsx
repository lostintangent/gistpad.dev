import { Button } from "@/shared/ui/button";
import { useDocument } from "@/features/editor/document";
import { useOpenDailyTemplate } from "../actions";
import { getFileDisplayName, TEMPLATE_FILENAME, type Gist } from "@/shared/github";
import { parseDateFilename } from "@/shared/dates";
import { startOfToday } from "date-fns";
import { useGist } from "../queries";
import { cn } from "cn";
import { Calendar, CheckSquare, FileText, Trash2 } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { ListItem } from "./ListItem";
import { deleteGistDialog } from "../dialogs/DeleteGistDialog";

/** The daily notes in a gist (i.e. not its template), with overdue notes first, then the newest. */
function getNotes(dailyNotes: Gist) {
  return Object.values(dailyNotes.files)
    .filter(({ filename }) => filename !== TEMPLATE_FILENAME)
    .map(({ filename, content = "" }) => {
      // Markdown task syntax: - [ ] or - [x]
      const totalTasks = content.match(/- \[[ x]\]/g)?.length ?? 0;
      const completedTasks = content.match(/- \[x\]/g)?.length ?? 0;

      // Notes are named after their date (e.g. `2025-01-31.md`), unlike other files (e.g. a README)
      const date = parseDateFilename(filename, "YYYY-MM-DD")?.date;

      return {
        filename,
        totalTasks,
        completedTasks,
        time: date?.getTime() ?? 0,
        // Whether the note is from a previous day, and still has incomplete tasks
        isOverdue: !!date && date < startOfToday() && completedTasks < totalTasks,
      };
    })
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || b.time - a.time);
}

const OVERDUE_BADGE_CLASSES =
  "ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 py-0.5 px-1.5 rounded-full";

export function DailyNotes({ dailyNotes }: { dailyNotes: Gist }) {
  const { gistId: openGistId, filename: openFilename } = useDocument();
  // The gist list doesn't include file contents, so load the full gist to count its tasks.
  const { data: gist = dailyNotes } = useGist(dailyNotes.id);
  const openTemplate = useOpenDailyTemplate();

  const notes = getNotes(gist);
  if (notes.length === 0) return null;

  const overdueTaskCount = notes
    .filter((note) => note.isOverdue)
    .reduce((total, note) => total + note.totalTasks - note.completedTasks, 0);

  return (
    <CollapsibleSection
      section="daily"
      icon={<Calendar />}
      title="Daily notes"
      count={notes.length}
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
      containsOpenGist={openGistId === dailyNotes.id}
      rowCount={notes.length}
    >
      {notes.map((note) => (
        <ListItem
          key={note.filename}
          gistId={dailyNotes.id}
          filename={note.filename}
          isOpen={openGistId === dailyNotes.id && openFilename === note.filename}
          compact
          action={
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() =>
                deleteGistDialog.openWithPayload({ gist: dailyNotes, filename: note.filename })
              }
              title="Delete daily note"
            >
              <Trash2 className="text-red-500" />
            </Button>
          }
        >
          <div
            className={cn(
              "flex justify-between items-center text-sm",
              note.isOverdue && "text-amber-700 dark:text-amber-400",
            )}
          >
            <span className="truncate">
              {getFileDisplayName(note.filename)}
              {note.isOverdue && <span className={OVERDUE_BADGE_CLASSES}>overdue</span>}
            </span>
            {note.totalTasks > 0 && (
              <span
                className={cn(
                  "text-xs flex items-center gap-1",
                  !note.isOverdue && "text-muted-foreground",
                )}
              >
                <CheckSquare className="h-3 w-3" />
                {note.completedTasks}/{note.totalTasks}
              </span>
            )}
          </div>
        </ListItem>
      ))}
    </CollapsibleSection>
  );
}
