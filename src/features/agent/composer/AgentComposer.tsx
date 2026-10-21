import { editorStatusAtom } from "@/features/editor/store";
import type { Command } from "@/features/commands/command";
import { executeCommand } from "@/features/commands/registry";
import { useDraft } from "@/features/files/draft";
import { useActiveFile } from "@/features/files/file";
import { useGists } from "@/features/gists/queries";
import { getFileDisplayName, getMarkdownFiles } from "@/shared/github";
import type { ActionBarSurface } from "@/features/workbench/action-bar/ActionBarView";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import { ArrowUp, Loader2, MicOff, Square } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { AnswerPanel } from "../ask/AnswerPanel";
import { EditPanel } from "../edit/EditPanel";
import { availableAgentCommands } from "../model/input";
import { resolveComposerMode, type ComposerMode } from "../model/modes";
import { agentStore, useIsAgentRunning, useRunningMode } from "../model/store";
import { useAgent } from "../model/useAgent";
import AgentSettingsDialog from "../settings/dialogs/AgentSettingsDialog";
import AnalyzeStyleDialog from "../settings/dialogs/AnalyzeStyleDialog";
import ModelSettingsDialog from "../settings/dialogs/ModelSettingsDialog";
import { useAgentSettings } from "../settings/useAgentSettings";
import { useTalkSession } from "../talk/useTalkSession";
import { useAgentCommands } from "./commands";
import { ModeMenu } from "./ModeMenu";
import { MODES } from "./modes";
import { PromptInput } from "./PromptInput";

/**
 * The action bar's surface for the agent: its prompt (with the mode menu, and a send button),
 * and the panels that its answers and edits dock above it. The composer owns its draft, mode,
 * results and voice session, which the workbench keeps mounted while the surface is hidden.
 */
export default function AgentComposer({
  isAvailable,
  showEdits,
  searchCommand,
  children,
}: {
  isAvailable: boolean;
  showEdits: boolean;
  /** The workbench's search, which typing ">" into the empty prompt runs (and the mode menu lists). */
  searchCommand: Command;
  children: (surface: ActionBarSurface) => ReactNode;
}) {
  const file = useActiveFile();
  const { run } = useAgent();
  const talk = useTalkSession(file, run);
  const settings = useAgentSettings(file);
  const { gists } = useGists();
  const hasSelection = useSelector(editorStatusAtom, (status) => status.hasSelection);
  const draft = useDraft(file);
  const answer = useSelector(agentStore, (state) => state.answer);
  const cancel = useSelector(agentStore, (state) => state.running?.cancel);
  const isAgentRunning = useIsAgentRunning() || talk.isAwaitingResponse;
  const isEditing = useRunningMode() === "edit";

  const [prompt, setPrompt] = useState("");
  const [previousPrompt, setPreviousPrompt] = useState("");
  const [selectedMode, setSelectedMode] = useState<ComposerMode>("auto");
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasFile = !!file.gistId;
  const mode = resolveComposerMode(selectedMode, hasFile, talk.isActive);

  // Questions share the review commands, while research and talk don't have custom commands
  const slashCommands = hasFile ? availableAgentCommands(settings, mode) : [];

  const showEditPanel = (!!draft?.hasPendingAgentEdit || isEditing) && showEdits;

  const sendPrompt = (prompt: string, explicitMode?: ComposerMode) => {
    setIsExpanded(false);

    const responseMode = explicitMode ?? mode;
    if (responseMode === "talk") return talk.sendCommand(prompt);

    return run(prompt, responseMode);
  };

  const commands = useAgentCommands({
    isAvailable,
    hasFile,
    isBusy: isAgentRunning,
    hasGists: gists.length > 0,
    settings,
    mode,
    onSelectMode: (mode) => {
      setSelectedMode(mode);
      // (When the mode is selected from the palette, the prompt is only shown once that's closed)
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    talk,
    run: sendPrompt,
  });

  const submit = () => {
    if (!prompt.trim() || (prompt === "/" && slashCommands.length > 0)) {
      // Sending an empty prompt toggles the list of slash commands.
      setPrompt(prompt === "/" ? "" : slashCommands.length > 0 ? "/" : "");
      inputRef.current?.focus();
      return;
    }

    setPreviousPrompt(prompt);
    setPrompt("");
    sendPrompt(prompt);
  };

  const { placeholder, selectionPlaceholder = placeholder } = MODES[mode];
  const ModeIcon = talk.isActive && talk.isMicMuted ? MicOff : MODES[mode].icon;
  const canSend = isAvailable && (!!prompt.trim() || slashCommands.length > 0);

  // (The panels dock above the prompt, and are clipped to the card's top corners)
  const panels = (answer || showEditPanel) && (
    <div className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-t-xl border-b animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      {answer && (
        <AnswerPanel
          answer={answer}
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded(!isExpanded)}
          onRun={(prompt) => sendPrompt(prompt, "ask")}
        />
      )}
      {showEditPanel && <EditPanel />}
    </div>
  );

  const surface: ActionBarSurface = {
    panel: panels,
    leading: {
      icon: (
        <ModeIcon
          className={cn(
            talk.isActive && (talk.isMicMuted ? "text-red-500" : "text-green-500"),
            talk.isActive && talk.isAssistantSpeaking && "animate-pulse",
          )}
        />
      ),
      label: "Select agent mode",
      menu: (
        <ModeMenu
          commands={commands}
          talk={talk}
          hasFile={hasFile}
          inputRef={inputRef}
          searchCommand={searchCommand}
        />
      ),
    },
    input: (
      <PromptInput
        ref={inputRef}
        value={prompt}
        // Typing ">" into the empty prompt opens the command palette.
        onValueChange={(value) =>
          value === ">" ? void executeCommand(searchCommand) : setPrompt(value)
        }
        onSubmit={submit}
        previousPrompt={previousPrompt}
        commands={hasSelection ? [] : slashCommands}
        gists={gists.filter(({ id }) => id !== file.gistId)}
        files={getMarkdownFiles(file.gist)
          .filter((name) => name !== file.filename)
          .map(getFileDisplayName)}
        placeholder={hasSelection ? selectionPlaceholder : placeholder}
        disabled={isAgentRunning || !isAvailable}
      />
    ),
    trailing: isAgentRunning
      ? {
          icon: cancel ? <Square className="text-red-500" /> : <Loader2 className="animate-spin" />,
          label: "Cancel",
          disabled: !cancel,
          onClick: cancel,
        }
      : { icon: <ArrowUp />, label: "Send", disabled: !canSend, onClick: submit },
    isExpanded,
    isBusy: isAgentRunning,
  };

  return (
    <>
      {/* (The surface carries the prompt's ref to the bar's JSX, which doesn't read it while rendering) */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {children(surface)}

      {/* The settings dialogs, which the mode menu's (and the palette's) commands open */}
      {commands.settingsView === "global-settings" && (
        <AgentSettingsDialog scope="global" onClose={commands.closeSettings} />
      )}
      {commands.settingsView === "file-settings" && (
        <AgentSettingsDialog scope="file" onClose={commands.closeSettings} />
      )}
      {commands.settingsView === "model-settings" && (
        <ModelSettingsDialog onClose={commands.closeSettings} />
      )}
      {commands.settingsView === "analyze-style" && (
        <AnalyzeStyleDialog gists={gists} onClose={commands.closeSettings} />
      )}
    </>
  );
}
