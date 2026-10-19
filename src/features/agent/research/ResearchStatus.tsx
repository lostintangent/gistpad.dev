import { timeAgo } from "@/shared/dates";
import { ScrollableText } from "@/shared/ScrollableText";
import { useTransientState } from "@/shared/useTransientState";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Bell, Check, CircleStop, Clipboard, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import ResearchResultsDialog from "./ResearchResultsDialog";
import { usePollResearchTasks, useResearchTasks } from "./useResearchTasks";

/** The user's research tasks, whose results can be viewed once they're done. */
export default function ResearchStatus({ className }: { className?: string }) {
  const { tasks, markSeen, cancel, remove } = useResearchTasks();

  // The status is always mounted, so it polls the tasks (until they're done)
  usePollResearchTasks();

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
          className={cn(
            "relative flex items-center justify-center size-8 rounded-full cursor-pointer text-purple-500 bg-purple-600/15",
            className,
          )}
          aria-label="Research tasks"
        >
          {inProgressCount > 0 ? (
            <>
              <Loader2 className="absolute size-3/4 animate-spin" />
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
                  markSeen(task.id);
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
                      ? `Completed ${timeAgo(task.completedTime ?? task.startedTime)}`
                      : `Started ${timeAgo(task.startedTime)}`}
                  </p>
                </div>
                {!task.content ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ml-3"
                    title="Cancel research"
                    onClick={() => cancel(task.id)}
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
          onDelete={() => remove(activeTask.id)}
        />
      )}
    </div>
  );
}
