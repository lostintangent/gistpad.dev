import { ScrollableText } from "@/shared/ScrollableText";
import { useTransientState } from "@/shared/useTransientState";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  usePreferences,
  useUpdatePreferences,
  type ResearchTask,
} from "@/features/session/queries";
import { queryOptions, useQueries } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CircleStop, Clipboard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ResearchResultsDialog from "./ResearchResultsDialog";

const POLLING_INTERVAL = 3000;

/** Manages the user's research tasks, which run in the background, and polls for their results. */
function useResearchTasks() {
  const { researchTasks } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const updateTask = (id: string, changes: Partial<ResearchTask>) =>
    updatePreferences(({ researchTasks }) => ({
      researchTasks: researchTasks.map((task) => (task.id === id ? { ...task, ...changes } : task)),
    }));

  const deleteTask = (id: string) =>
    updatePreferences(({ researchTasks }) => ({
      researchTasks: researchTasks.filter((task) => task.id !== id),
    }));

  // Poll each in-progress task until it's done
  useQueries({
    queries: researchTasks
      .filter((task) => !task.content)
      .map((task) =>
        queryOptions({
          queryKey: ["research", task.id],
          queryFn: async () => {
            const { pollResearchTask } = await import("../agents");
            const result = await pollResearchTask(task.id);

            if (result && "error" in result) {
              deleteTask(task.id);
              toast.error(`Research about "${task.topic}" didn't complete.`, {
                description: result.error,
              });
            } else if (result) {
              updateTask(task.id, {
                ...result,
                completedTime: new Date().toISOString(),
                hasBeenSeen: false,
              });
            }

            return result;
          },
          refetchInterval: ({ state }) => (state.data ? false : POLLING_INTERVAL),
          meta: { persist: false },
        }),
      ),
  });

  return { tasks: researchTasks, updateTask, deleteTask };
}

export default function ResearchStatus() {
  const { tasks, updateTask, deleteTask } = useResearchTasks();

  // The task whose results are being viewed (which closes once it's saved or deleted)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const [copiedTaskId, setCopiedTaskId] = useTransientState<string | null>(null);

  if (tasks.length === 0) return null;

  const inProgressCount = tasks.filter((task) => !task.content).length;
  const hasUnseenResults = tasks.some((task) => task.content && !task.hasBeenSeen);

  return (
    <div className="flex flex-col gap-2">
      <Popover>
        <PopoverTrigger
          className="relative flex items-center justify-center w-8 h-8 rounded-full cursor-pointer text-purple-500 bg-purple-600/15"
          aria-label="Research tasks"
        >
          {inProgressCount > 0 ? (
            <>
              <Loader2 className="absolute h-6 w-6 animate-spin" />
              <span className="font-medium text-xs text-white">{inProgressCount}</span>
            </>
          ) : (
            <>
              <Bell className="h-4 w-4" />
              {hasUnseenResults && (
                <span className="absolute top-0 right-0 bg-blue-500 rounded-full w-2 h-2" />
              )}
            </>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" initialFocus={false}>
          <div className="flex flex-col gap-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer group"
                onClick={() => {
                  if (!task.content) return;
                  updateTask(task.id, { hasBeenSeen: true });
                  setActiveTaskId(task.id);
                }}
              >
                <div className="flex flex-col flex-1 gap-1">
                  <div className="flex items-center">
                    <ScrollableText className="text-sm flex-1 w-0">
                      {task.title || task.topic}
                    </ScrollableText>
                    {task.content && !task.hasBeenSeen && (
                      <span className="ml-2 bg-blue-500 rounded-full w-2 h-2" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {task.content
                      ? `Completed ${formatDistanceToNow(task.completedTime ?? task.startedTime, { addSuffix: true })}`
                      : `Started ${formatDistanceToNow(task.startedTime, { addSuffix: true })}`}
                  </p>
                </div>
                {!task.content ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ml-3"
                    title="Cancel research"
                    onClick={async () => {
                      const { cancelResponse } = await import("../agents");
                      await cancelResponse(task.id);
                      deleteTask(task.id);
                    }}
                  >
                    <CircleStop className="text-red-500" />
                  </Button>
                ) : (
                  task.hasBeenSeen && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="ml-3 hover:text-green-500"
                      title="Copy results"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(task.content!);
                        setCopiedTaskId(task.id);
                      }}
                    >
                      {copiedTaskId === task.id ? (
                        <Check className="text-green-500" />
                      ) : (
                        <Clipboard />
                      )}
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {activeTask?.content && (
        <ResearchResultsDialog
          task={activeTask}
          onClose={() => setActiveTaskId(null)}
          onDelete={() => deleteTask(activeTask.id)}
        />
      )}
    </div>
  );
}
