import { getGistById, Gist, GistData } from "@/lib/github";
import { useQueryClient } from "@tanstack/react-query";
import { isToday, parse } from "date-fns";
import { useEffect, useState } from "react";

export interface DailyTaskStats {
  filename: string;
  totalTasks: number;
  completedTasks: number;
  isPastDueWithTasks: boolean; // Flag for past notes with incomplete tasks
  date: Date | null; // The date from the filename
}

export function useDailyTasks(dailyNotes: Gist | null) {
  const [taskStats, setTaskStats] = useState<DailyTaskStats[]>([]);
  const [isLoadingFullGist, setIsLoadingFullGist] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    async function processGistContent() {
      if (!dailyNotes) {
        setTaskStats([]);
        return;
      }

      // Check if any files exist and have content
      const filesExist = Object.keys(dailyNotes.files).length > 0;
      const anyMissingContent = Object.values(dailyNotes.files).some(
        (file) => file.content === undefined
      );

      // If files are missing content, fetch the full gist
      if (filesExist && anyMissingContent && !isLoadingFullGist) {
        setIsLoadingFullGist(true);

        try {
          // Fetch the complete gist to get file contents
          const fullGist = await getGistById(dailyNotes.id);

          // Update the React Query cache with the complete gist
          queryClient.setQueryData(
            ["gists"],
            (oldData: GistData | undefined) => {
              if (!oldData) return oldData;

              return {
                ...oldData,
                dailyNotes: fullGist,
              };
            }
          );

          // Process the updated gist with contents
          processGistStats(fullGist);
        } catch (error) {
          console.error("Error fetching complete daily notes gist:", error);
        } finally {
          setIsLoadingFullGist(false);
        }

        return;
      }

      // If all content is available, process it directly
      processGistStats(dailyNotes);
    }

    function processGistStats(gist: Gist) {
      const stats: DailyTaskStats[] = [];
      const today = new Date();

      // Compile regex patterns once
      const taskPattern = /- \[([ x])\]/g;
      const completedTaskPattern = /- \[x\]/g;

      // Process each file in the daily notes gist
      Object.values(gist.files).forEach((file) => {
        // Skip files without content (shouldn't happen after our fetch, but just in case)
        if (file.content === undefined) {
          console.warn(`File ${file.filename} has no content`);
          return;
        }

        const content = file.content; // We already checked it's defined

        // Parse task items using regex
        // Look for Markdown task syntax: - [ ] or - [x]
        const totalTaskMatches = content.match(taskPattern) || [];
        const completedTaskMatches = content.match(completedTaskPattern) || [];

        // Extract date from filename (assuming format YYYY-MM-DD.md)
        let date: Date | null = null;
        let isPastDueWithTasks = false;

        try {
          // Try to parse date from filename
          const filenameWithoutExt = file.filename.replace(/\.md$/, "");
          date = parse(filenameWithoutExt, "yyyy-MM-dd", new Date());

          // Check if it's a past date with incomplete tasks
          const hasUncompletedTasks =
            totalTaskMatches.length > completedTaskMatches.length;
          isPastDueWithTasks =
            !isToday(date) && date < today && hasUncompletedTasks;
        } catch (e) {
          // If filename doesn't match expected date format, just continue
          console.warn(`Could not parse date from filename: ${file.filename}`);
        }

        stats.push({
          filename: file.filename,
          totalTasks: totalTaskMatches.length,
          completedTasks: completedTaskMatches.length,
          isPastDueWithTasks,
          date,
        });
      });

      // Sort by date, with past-due notes with tasks first
      stats.sort((a, b) => {
        // First, sort by past-due status
        if (a.isPastDueWithTasks && !b.isPastDueWithTasks) return -1;
        if (!a.isPastDueWithTasks && b.isPastDueWithTasks) return 1;

        // Then by date (newest first)
        if (a.date && b.date) {
          return b.date.getTime() - a.date.getTime();
        }

        return 0;
      });

      setTaskStats(stats);
    }

    processGistContent();
  }, [dailyNotes, queryClient]);

  return taskStats;
}
