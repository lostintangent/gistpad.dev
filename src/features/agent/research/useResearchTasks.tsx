import {
  usePreferences,
  useUpdatePreferences,
  type ResearchTask,
} from "@/features/account/queries";
import { queryOptions, useQueries } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import type { ResearchRequest, ResearchResult } from "./research";

// Research tasks run in the background (as OpenAI responses). The tasks are saved in the user's
// preferences (so they're seen on every device), until their results are saved or deleted. But
// their results stay with OpenAI (which keeps them for 30 days), and are fetched when they're
// viewed: the preferences are embedded in the user's access token, which a document makes too
// large to send.

const POLLING_INTERVAL = 3000;

function useUpdateTasks() {
  const updatePreferences = useUpdatePreferences();
  return (update: (tasks: ResearchTask[]) => ResearchTask[]) =>
    updatePreferences(({ researchTasks }) => ({ researchTasks: update(researchTasks) }));
}

const updateTask = (id: string, changes: Partial<ResearchTask>) => (tasks: ResearchTask[]) =>
  tasks.map((task) => (task.id === id ? { ...task, ...changes } : task));

const removeTask = (id: string) => (tasks: ResearchTask[]) =>
  tasks.filter((task) => task.id !== id);

/** The user's research tasks, and the actions for starting, viewing and removing them. */
export function useResearchTasks() {
  const { researchTasks: tasks } = usePreferences();
  const updateTasks = useUpdateTasks();

  return {
    tasks,

    /** Starts researching a topic, whose results are saved to the gist (if there is one). */
    start: async (request: ResearchRequest, gistId?: string) => {
      const { startResearch } = await import("../openai");
      const id = await startResearch(request);

      const startedTime = new Date().toISOString();
      updateTasks((tasks) => [...tasks, { id, gistId, topic: request.topic, startedTime }]);
    },

    markSeen: (id: string) => updateTasks(updateTask(id, { hasBeenSeen: true })),

    /** Removes a completed task (e.g. once its results are saved). */
    remove: (id: string) => updateTasks(removeTask(id)),

    /** Cancels (and removes) a task that's in progress. */
    cancel: async (id: string) => {
      const { cancelResearch } = await import("../openai");
      await cancelResearch(id);
      updateTasks(removeTask(id));
    },
  };
}

/**
 * The tasks' results, by task (once they've been fetched). The tasks in progress are polled until
 * they complete (or fail, which removes them), which the research status is always mounted for.
 */
export function useResearchResults() {
  const { researchTasks: tasks } = usePreferences();
  const updateTasks = useUpdateTasks();

  // Results used to be saved in the tasks themselves (which made the access token too large), so
  // any that still are get dropped: OpenAI still has them
  useEffect(() => {
    if (!tasks.some((task) => "content" in task)) return;
    updateTasks((tasks) =>
      tasks.map(({ id, gistId, topic, startedTime, completedTime, hasBeenSeen }) => ({
        id,
        gistId,
        topic,
        startedTime,
        completedTime,
        hasBeenSeen,
      })),
    );
  }, [tasks, updateTasks]);

  return useQueries({
    queries: tasks.map((task) =>
      queryOptions({
        queryKey: ["research", task.id],
        queryFn: async (): Promise<ResearchResult | null> => {
          const { pollResearch } = await import("../openai");
          const result = await pollResearch(task.id);
          if (!result) return null;

          if ("error" in result) {
            updateTasks(removeTask(task.id));
            toast.error(`Research about "${task.topic}" didn't complete.`, {
              description: result.error,
            });
            return null;
          }

          if (!task.completedTime) {
            const completedTime = new Date().toISOString();
            updateTasks(updateTask(task.id, { completedTime, hasBeenSeen: false }));
          }
          return result;
        },
        staleTime: Infinity,
        refetchInterval: ({ state }) => (state.data ? false : POLLING_INTERVAL),
        meta: { persist: false },
      }),
    ),
    combine: (results): Record<string, ResearchResult | undefined> =>
      Object.fromEntries(tasks.map((task, index) => [task.id, results[index]?.data ?? undefined])),
  });
}
