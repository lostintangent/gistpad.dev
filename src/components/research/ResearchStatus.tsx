import { ResearchTask } from "@/hooks/useUserSession";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CircleStop, Clipboard, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ScrollableText } from "../ScrollableText";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import ResearchResultsDialog from "./ResearchResultsDialog";

interface ResearchStatusProps {
  tasks: ResearchTask[];
  onDeleteTaskResults: (id: string) => void;
  onCancelTask: (id: string) => Promise<void>;
  onSaveTaskResults: (task: ResearchTask) => Promise<void>;
  onViewTaskResults: (id: string) => void;
}

export default function ResearchStatus({
  tasks,
  onDeleteTaskResults,
  onCancelTask,
  onSaveTaskResults,
  onViewTaskResults,
}: ResearchStatusProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [activeTask, setActiveTask] = useState<ResearchTask | null>(null);
  const [copiedTask, setCopiedTask] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedTask) return;

    const timeout = setTimeout(() => setCopiedTask(null), 3000);
    return () => clearTimeout(timeout);
  }, [copiedTask]);

  if (tasks.length === 0) return null;

  const inProgressCount = tasks.filter((t) => !t.content).length;

  const hasUnseen = tasks.some((t) => t.content && !t.hasBeenSeen);

  const trigger =
    inProgressCount > 0 ? (
      <div
        className="relative flex items-center justify-center w-8 h-8 rounded-full cursor-pointer text-purple-500 mr-2"
        style={{ backgroundColor: "rgba(147, 51, 234, 0.17)" }}
      >
        <Loader2 className="absolute h-6 w-6 animate-spin" />
        <span className="font-medium text-xs text-white">
          {inProgressCount}
        </span>
      </div>
    ) : (
      <div
        className="relative flex items-center justify-center w-8 h-8 rounded-full cursor-pointer text-purple-500 mr-2"
        style={{ backgroundColor: "rgba(147, 51, 234, 0.17)" }}
      >
        <Bell className="h-4 w-4" />
        {hasUnseen && (
          <span className="absolute top-0 right-0 bg-blue-500 rounded-full w-2 h-2" />
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-80 p-2" autoFocus={false}>
          <div className="flex flex-col gap-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer group"
                onClick={() => {
                  if (task.content) {
                    onViewTaskResults(task.id);
                    setActiveTask(task);
                  }
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
                      ? `Completed ${formatDistanceToNow(
                        new Date(task.completedTime ?? Date.now()),
                        { addSuffix: true }
                      )}`
                      : `Started ${formatDistanceToNow(
                        new Date(task.startedTime),
                        { addSuffix: true }
                      )}`}
                  </p>
                </div>
                {!task.content ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-3"
                    onClick={() => onCancelTask(task.id)}
                  >
                    <CircleStop className="h-4 w-4 text-red-500" />
                  </Button>
                ) : task.hasBeenSeen ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-3 hover:text-green-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(task.content);
                      setCopiedTask(task.id);
                    }}
                  >
                    {copiedTask === task.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clipboard className="h-4 w-4" />
                    )}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {activeTask?.content && (
        <ResearchResultsDialog
          isOpen={true}
          onOpenChange={(open) => {
            if (!open) setActiveTask(null);
          }}
          content={activeTask.content}
          topic={activeTask.topic}
          onSave={async () => {
            await onSaveTaskResults(activeTask);
            setActiveTask(null);
          }}
          onClear={() => {
            onDeleteTaskResults(activeTask.id);
            setActiveTask(null);
          }}
        />
      )}
    </div>
  );
}
