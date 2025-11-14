import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FollowUpButton({
  question,
  onClick,
  className = "",
  disabled = false,
}: {
  question: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`w-full h-auto flex items-center justify-between gap-3 p-3 bg-linear-to-r from-green-500/10 to-purple-500/10 hover:to-purple-500/20 hover:from-green-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-foreground transition-all duration-200 group ${className}`}
      onClick={onClick}
      title="Run follow up"
      disabled={disabled}
    >
      <span className="text-sm font-medium text-left break-words whitespace-normal italic">
        {question}
      </span>
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
    </Button>
  );
}
