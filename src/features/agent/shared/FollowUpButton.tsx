import { Button } from "@/shared/ui/button";
import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import { useIsAgentRunning } from "../model/store";
import type { AgentFollowUp } from "../model/response";

/** Runs a follow-up that the agent suggested (which is disabled while another command is running). */
export function FollowUpButton({
  followUp,
  onRun,
  className,
}: {
  followUp: AgentFollowUp;
  onRun: (topic: string) => void;
  className?: string;
}) {
  const isAgentRunning = useIsAgentRunning();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "w-full h-auto flex items-center justify-between gap-3 p-3 bg-linear-to-r from-green-500/10 to-purple-500/10 hover:to-purple-500/20 hover:from-green-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-foreground transition-all duration-200 group",
        className,
      )}
      onClick={() => onRun(followUp.topic)}
      title="Run follow up"
      disabled={isAgentRunning}
    >
      <span className="text-sm font-medium text-left break-words whitespace-normal italic">
        {followUp.question}
      </span>
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
    </Button>
  );
}
