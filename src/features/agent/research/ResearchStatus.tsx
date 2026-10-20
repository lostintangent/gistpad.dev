import { timeAgo } from "@/shared/dates";
import { ScrollableText } from "@/shared/ScrollableText";
import { useTransientState } from "@/shared/useTransientState";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Bell, Check, Clipboard, Loader2, Square } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import ResearchResultsDialog from "./ResearchResultsDialog";
import { useResearchResults, useResearchTasks } from "./useResearchTasks";

/** The user's research tasks, whose results can be viewed once they're done. */
export default function ResearchStatus({ className }: { className?: string }) {
  const { tasks, markSeen, cancel, remove } = useResearchTasks();

  // The status is always mounted, so it polls the tasks (until they're done)
  const results = useResearchResults();

  // The task whose results are being viewed (which closes once it's saved or deleted)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const [copiedTaskId, setCopiedTaskId] = useTransientState<string | null>(null);

  if (tasks.length === 0) return null;

  const inProgressCount = tasks.filter((task) => !task.completedTime).length;
  const hasUnseenResults = tasks.some((task) => task.completedTime && !task.hasBeenSeen);

  return (
    <div className="flex flex-col gap-2">
      <Popover>
        <PopoverTrigger
          className={cn(
            "relative flex items-center justify-center size-8 rounded-full cursor-pointer text-accent bg-accent/15",
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
                <span className="absolute top-0 right-0 bg-blue-500 rounded-full size-2 ring-2 ring-backdrop" />
              )}
            </>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" initialFocus={false}>
          <div className="flex flex-col gap-1">
            {tasks.map((task) => {
              const result = results[task.id];
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer group"
                  onClick={() => {
                    if (!task.completedTime) return;
                    markSeen(task.id);
                    setActiveTaskId(task.id);
                  }}
                >
                  <div className="flex min-w-0 flex-col flex-1 gap-1">
                    <ScrollableText className="text-sm">
                      {result?.title ?? task.topic}
                    </ScrollableText>
                    <p className="text-xs text-muted-foreground">
                      {task.completedTime
                        ? `Completed ${timeAgo(task.completedTime)}`
                        : `Started ${timeAgo(task.startedTime)}`}
                    </p>
                  </div>
                  <div className="ml-3 flex size-6 shrink-0 items-center justify-center">
                    {!task.completedTime ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Cancel research"
                        onClick={() => cancel(task.id)}
                      >
                        <Square className="text-red-500" />
                      </Button>
                    ) : !task.hasBeenSeen ? (
                      <span className="bg-blue-500 rounded-full size-2" />
                    ) : (
                      result && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="hover:text-green-500"
                          title="Copy results"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(result.content);
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
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {activeTask?.completedTime && (
        <ResearchResultsDialog
          task={activeTask}
          result={results[activeTask.id]}
          onClose={() => setActiveTaskId(null)}
          onDelete={() => remove(activeTask.id)}
        />
      )}
    </div>
  );
}
