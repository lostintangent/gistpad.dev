import { useEditorMode } from "@/features/editor/mode";
import { editorStatusAtom } from "@/features/editor/store";
import { useDraft } from "@/features/files/draft";
import { useActiveFile } from "@/features/files/file";
import { useGists } from "@/features/gists/queries";
import { getFileDisplayName, getMarkdownFiles } from "@/shared/github";
import { Button } from "@/shared/ui/button";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import { CircleStop, Loader2, SendHorizonal } from "lucide-react";
import { useRef, useState } from "react";
import { expandCustomCommand } from "../model/commands";
import type { ComposerMode } from "../model/modes";
import { agentStore, useIsAgentRunning, useRunningMode } from "../model/store";
import { useAgent } from "../model/useAgent";
import { useAgentSettings } from "../settings/useAgentSettings";
import { useVoiceConversation } from "../voice/useVoiceConversation";
import { AnswerPanel } from "./AnswerPanel";
import { CommandInput } from "./CommandInput";
import { EditPanel } from "./EditPanel";
import { MODES, ModeMenu } from "./ModeMenu";

/**
 * The agent's floating composer, for running commands against the active file (or the user's
 * gists), and viewing their results. It's only loaded once the user has configured the agent.
 */
export default function AgentComposer({ isVisible }: { isVisible: boolean }) {
  const file = useActiveFile();
  const { run } = useAgent();
  const voice = useVoiceConversation(file, run);
  const settings = useAgentSettings(file);
  const { gists } = useGists();
  const [editorMode] = useEditorMode();
  const hasSelection = useSelector(editorStatusAtom, (status) => status.hasSelection);
  const draft = useDraft(file);
  const answer = useSelector(agentStore, (state) => state.answer);
  const cancel = useSelector(agentStore, (state) => state.running?.cancel);
  const isAgentRunning = useIsAgentRunning() || voice.isAwaitingResponse;
  const isEditing = useRunningMode() === "edit";

  const [command, setCommand] = useState("");
  const [previousCommand, setPreviousCommand] = useState("");
  const [selectedMode, setSelectedMode] = useState<ComposerMode>("auto");
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasFile = !!file.gistId;
  const mode: ComposerMode = voice.isActive && hasFile ? "talk" : selectedMode;

  // Questions share the review commands, while research and talk don't have custom commands
  const commands =
    !hasFile || mode === "research" || mode === "talk"
      ? []
      : settings[mode === "edit" ? "edit" : "review"].commands;

  const showEditPanel = (!!draft?.hasPendingAgentEdit || isEditing) && editorMode !== "preview";

  // When there isn't an active file, the composer is centered (rather than at the bottom)
  const isCentered = !hasFile && answer === null;

  const runCommand = (command: string, explicitMode?: ComposerMode) => {
    setIsExpanded(false);

    const commandMode = explicitMode ?? mode;
    if (commandMode === "talk") return voice.sendCommand(command);

    // Custom commands are questions, unless they're run in a specific mode
    const customCommand = expandCustomCommand(command, commands);
    if (customCommand) return run(customCommand, commandMode === "auto" ? "ask" : commandMode);

    return run(command, commandMode);
  };

  const submit = () => {
    if (!command.trim()) {
      // Sending an empty command toggles the list of custom commands
      setCommand(command === "/" ? "" : commands.length > 0 ? "/" : "");
      inputRef.current?.focus();
      return;
    }

    setPreviousCommand(command);
    setCommand("");
    runCommand(command);
  };

  const { placeholder, selectionPlaceholder = placeholder } = MODES[mode];

  // While hidden (e.g. while the comments are open on mobile), the composer stays mounted,
  // so that voice conversations (and the command being written) aren't lost.
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute left-1/2 z-50 w-[85%] -translate-x-1/2 transition-all ease-in-out duration-300",
        !isExpanded && "max-w-[470px]",
        isCentered ? "bottom-1/2 translate-y-5" : "bottom-5",
      )}
    >
      {(answer || showEditPanel) && (
        <div
          className={cn(
            "absolute bottom-full w-full translate-y-[5px] flex flex-col overflow-hidden divide-y divide-border/50 bg-card/95 backdrop-blur-sm border border-border/50 hover:border-border/70 shadow-2xl dark:shadow-dark-xl animate-in slide-in-from-bottom-2 transition-all duration-300",
            answer && !isExpanded ? "rounded-t-xl" : "rounded-xl",
          )}
        >
          {answer && (
            <AnswerPanel
              answer={answer}
              isExpanded={isExpanded}
              onToggleExpanded={() => setIsExpanded(!isExpanded)}
              onRun={(command) => runCommand(command, "ask")}
            />
          )}
          {showEditPanel && <EditPanel />}
        </div>
      )}

      <div
        className={cn(
          "relative p-[2px] rounded-md bg-linear-to-r from-green-400 to-purple-600 max-w-[470px] mx-auto transition-shadow duration-300 ease-in-out",
          isCentered ? "shadow-centered-composer" : "shadow-lg",
        )}
      >
        <div className="bg-background rounded-md p-1 flex">
          <ModeMenu
            mode={mode}
            onSelectMode={setSelectedMode}
            voice={voice}
            hasFile={hasFile}
            inputRef={inputRef}
          />

          <CommandInput
            ref={inputRef}
            value={command}
            onValueChange={setCommand}
            onSubmit={submit}
            previousCommand={previousCommand}
            commands={hasSelection ? [] : commands}
            gists={gists.filter(({ id }) => id !== file.gistId)}
            files={getMarkdownFiles(file.gist)
              .filter((name) => name !== file.filename)
              .map(getFileDisplayName)}
            placeholder={hasSelection ? selectionPlaceholder : placeholder}
            disabled={isAgentRunning}
          />

          <Button
            variant="ghost"
            onClick={isAgentRunning ? cancel : submit}
            disabled={isAgentRunning ? !cancel : !command.trim() && commands.length === 0}
            className={cn(
              "rounded h-auto p-1!",
              isAgentRunning && cancel ? "hover:text-white" : "hover:bg-muted",
            )}
            aria-label={isAgentRunning ? "Cancel" : "Send"}
          >
            {!isAgentRunning ? (
              <SendHorizonal />
            ) : cancel ? (
              <CircleStop />
            ) : (
              <Loader2 className="animate-spin" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
