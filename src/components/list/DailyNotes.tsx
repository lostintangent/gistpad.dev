import { useDailyTasks } from "@/components/list/hooks/useDailyTasks";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/useMobile";
import { Gist, TEMPLATE_FILENAME } from "@/lib/github";
import {
  Calendar,
  CheckSquare,
  ChevronRight,
  FileText,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface DailyNotesProps {
  dailyNotes: Gist | null;
  onSelectGist: (gist: Gist, filename: string) => void;
  onDeleteFile: (e: React.MouseEvent, gist: Gist, filename: string) => void;
  selectedGistId: string | null;
  selectedFile?: string;
  onOpenTemplate?: () => void;
}

export function DailyNotes({
  dailyNotes,
  onSelectGist,
  onDeleteFile,
  selectedGistId,
  selectedFile,
  onOpenTemplate,
}: DailyNotesProps) {
  // Get task stats directly from the hook
  const dailyTaskStats = useDailyTasks(dailyNotes);
  const isMobile = useIsMobile();

  // State for section collapsed status
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("gistpad-daily-collapsed");
    return saved ? JSON.parse(saved) : true;
  });

  // Auto-expand section when a daily note is selected
  useEffect(() => {
    // Don't auto-expand on mobile, since the notes list
    // is hdiden while viewing a daily note
    if (isMobile) return;

    if (selectedGistId && dailyNotes?.id === selectedGistId) {
      setIsCollapsed(false);
    }
  }, [selectedGistId, dailyNotes, isMobile]);

  // Save collapse state to localStorage
  useEffect(() => {
    localStorage.setItem(
      "gistpad-daily-collapsed",
      JSON.stringify(isCollapsed)
    );
  }, [isCollapsed]);

  // No dailyNotes, don't render anything
  if (!dailyNotes) return null;

  // Filter out template.md from the list
  const dailyNoteFiles = Object.values(dailyNotes.files).filter(
    (file) => file.filename !== TEMPLATE_FILENAME
  );

  // Calculate overdue task metrics
  const hasOverdueTasks = dailyTaskStats.some(
    (stats) => stats.isPastDueWithTasks
  );
  const totalOverdueTasks = hasOverdueTasks
    ? dailyTaskStats
      .filter((stats) => stats.isPastDueWithTasks)
      .reduce(
        (total, stats) => total + (stats.totalTasks - stats.completedTasks),
        0
      )
    : 0;

  // Sort files to match the task stats order (which puts past-due notes first)
  const sortedDailyNoteFiles = [...dailyNoteFiles].sort((a, b) => {
    const aStats = dailyTaskStats.find(
      (stats) => stats.filename === a.filename
    );
    const bStats = dailyTaskStats.find(
      (stats) => stats.filename === b.filename
    );

    // Put past-due notes first
    if (aStats?.isPastDueWithTasks && !bStats?.isPastDueWithTasks) return -1;
    if (!aStats?.isPastDueWithTasks && bStats?.isPastDueWithTasks) return 1;

    // Then sort by date (newest first)
    if (aStats?.date && bStats?.date) {
      return bStats.date.getTime() - aStats.date.getTime();
    }

    return 0;
  });

  // Function to handle clicking on a daily note file
  const handleDailyFileClick = (gist: Gist, filename: string) => {
    setIsCollapsed(false);
    onSelectGist(gist, filename);
  };

  // Check if a file is selected
  const isFileSelected = (gistId: string, filename?: string) => {
    return (
      gistId === selectedGistId && (filename ? filename === selectedFile : true)
    );
  };

  if (dailyNoteFiles.length === 0) return null;

  return (
    <div className="flex-none border-t">
      <button
        className={`w-full p-2 flex items-center bg-muted/30 hover:bg-muted/60 transition-colors ${isCollapsed ? "" : "border-b"}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 grow">
          <div
            className="transition-transform duration-200"
            style={{
              transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </div>
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-blue-400 mr-1" />
            <span>Daily notes ({dailyNoteFiles.length})</span>
            {isCollapsed && hasOverdueTasks && (
              <span className="ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 py-0.5 px-1.5 rounded-full flex items-center">
                <span className="mr-1">{totalOverdueTasks}</span>
                overdue
              </span>
            )}
          </div>
        </div>
        {onOpenTemplate && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 mr-2"
            onClick={onOpenTemplate}
            title="Edit template"
          >
            <FileText className="h-3.5 w-3.5 text-blue-400" />
          </Button>
        )}
      </button>
      <div
        className={`transition-[height,opacity] duration-200 ease-in-out overflow-hidden ${isCollapsed
            ? "h-0 opacity-0"
            : dailyNoteFiles.length <= 1
              ? "h-[50px] opacity-100"
              : "h-[95px] opacity-100"
          }`}
      >
        <ScrollArea className="h-full">
          <div className="p-2 space-y-1">
            {sortedDailyNoteFiles.map((file) => (
              <div key={file.filename} className="flex items-center gap-2">
                {(() => {
                  const fileStats = dailyTaskStats.find(
                    (stats) => stats.filename === file.filename
                  );
                  const isPastDue = fileStats?.isPastDueWithTasks;

                  return (
                    <button
                      onClick={() =>
                        handleDailyFileClick(dailyNotes, file.filename)
                      }
                      className={`flex-1 text-left p-2 rounded-lg transition-colors max-w-[calc(100%-3rem)] 
                        ${isFileSelected(dailyNotes.id, file.filename)
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <h3
                          className={`font-medium truncate ${isFileSelected(dailyNotes.id, file.filename)
                              ? "" // When selected, use default selection color
                              : isPastDue
                                ? "text-amber-700 dark:text-amber-400"
                                : ""
                            }`}
                        >
                          {file.filename.replace(/\.md$/, "")}
                          {isPastDue &&
                            !isFileSelected(dailyNotes.id, file.filename) && (
                              <span className="ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 py-0.5 px-1.5 rounded-full">
                                overdue
                              </span>
                            )}
                          {isPastDue &&
                            isFileSelected(dailyNotes.id, file.filename) && (
                              <span className="ml-2 text-xs bg-primary-foreground/20 text-primary-foreground py-0.5 px-1.5 rounded-full">
                                overdue
                              </span>
                            )}
                        </h3>
                        {fileStats && fileStats.totalTasks > 0 && (
                          <span
                            className={`text-xs flex items-center gap-1 ${isFileSelected(dailyNotes.id, file.filename)
                                ? "text-primary-foreground" // Use same color as selected text for better contrast
                                : isPastDue
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                              }`}
                          >
                            <CheckSquare className="h-3 w-3" />
                            {fileStats.completedTasks}/{fileStats.totalTasks}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })()}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => onDeleteFile(e, dailyNotes, file.filename)}
                  className="shrink-0"
                  title="Delete daily note"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
