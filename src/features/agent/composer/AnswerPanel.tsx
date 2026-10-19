import { openFile } from "@/features/files/file";
import { useGists } from "@/features/gists/queries";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useIsMobile } from "@/shared/useMediaQuery";
import { Clipboard, Maximize, Minimize, MoreHorizontal, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateAgentState, useIsAgentRunning, type AgentAnswer } from "../model/store";
import { FollowUpButton } from "../shared/FollowUpButton";
import { LoadingMessage } from "../shared/LoadingMessage";

const ROUND_BUTTON_CLASSES =
  "text-muted-foreground hover:text-foreground bg-background/80 hover:bg-background backdrop-blur-sm rounded-full p-1.5 transition-all duration-200 hover:scale-110 shadow-sm";

/** The answer to an "ask" command (which is displayed above the composer). */
export function AnswerPanel({
  answer,
  isExpanded,
  onToggleExpanded,
  onRun,
}: {
  answer: AgentAnswer;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRun: (command: string) => void;
}) {
  const isMobile = useIsMobile();
  const isAgentRunning = useIsAgentRunning();
  const { gists } = useGists();
  const contentRef = useRef<HTMLDivElement>(null);
  const [canExpand, setCanExpand] = useState(false);

  // Keep the end of the answer in view, as it streams in.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [answer.text, answer.followUp?.question]);

  return (
    <div className="relative">
      {!isAgentRunning && (
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <DropdownMenu
            onOpenChange={(open) => {
              // Answers can only be expanded when they overflow
              const content = contentRef.current;
              if (open && content)
                setCanExpand(isExpanded || content.scrollHeight > content.clientHeight);
            }}
          >
            <DropdownMenuTrigger className={ROUND_BUTTON_CLASSES} aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isMobile && canExpand && (
                <DropdownMenuItem onClick={onToggleExpanded}>
                  {isExpanded ? <Minimize /> : <Maximize />}
                  {isExpanded ? "Collapse" : "Expand"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(answer.text)}>
                <Clipboard /> Copy contents
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRun("Try again")}>
                <RotateCcw /> Try again
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => updateAgentState({ answer: null })}
            className={ROUND_BUTTON_CLASSES}
            aria-label="Close agent response"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* The answer fades out at the edges that can be scrolled to */}
      <div
        ref={contentRef}
        className={`overflow-y-auto no-scrollbar scroll-fade-y scroll-fade-20 ${
          isExpanded ? "max-h-[75vh]" : "max-h-[60vh]"
        } ${answer.text ? "p-4 pr-12" : ""}`}
      >
        {answer.text ? (
          <>
            <MarkdownPreview gists={gists} onOpenGist={openFile} isReadOnly>
              {answer.text}
            </MarkdownPreview>
            {answer.followUp?.question && (
              <FollowUpButton followUp={answer.followUp} onRun={onRun} className="mt-6 mb-1" />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <LoadingMessage
              reasoningSummary={answer.reasoningSummary}
              isWebSearching={answer.isWebSearching}
              showCompactDetails
            />
          </div>
        )}
      </div>
    </div>
  );
}
