import {
  usePreferences,
  useUpdatePreferences,
  type ResearchTask,
} from "@/features/account/queries";
import { queryOptions, useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ResearchRequest } from "./research";

// Research tasks run in the background (as OpenAI responses), and are saved in the user's
// preferences (so they survive reloads), until their results are saved or deleted.

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

/** Polls the in-progress research tasks, until they complete (or fail). */
export function usePollResearchTasks() {
  const { researchTasks: tasks } = usePreferences();
  const updateTasks = useUpdateTasks();

  useQueries({
    queries: tasks
      .filter((task) => !task.content)
      .map((task) =>
        queryOptions({
          queryKey: ["research", task.id],
          queryFn: async () => {
            const { pollResearch } = await import("../openai");
            const result = await pollResearch(task.id);

            if (result && "error" in result) {
              updateTasks(removeTask(task.id));
              toast.error(`Research about "${task.topic}" didn't complete.`, {
                description: result.error,
              });
            } else if (result) {
              const completedTime = new Date().toISOString();
              updateTasks(updateTask(task.id, { ...result, completedTime, hasBeenSeen: false }));
            }

            return result;
          },
          refetchInterval: ({ state }) => (state.data ? false : POLLING_INTERVAL),
          meta: { persist: false },
        }),
      ),
  });
}
