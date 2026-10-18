import { AiLoadingMessage } from "./AiLoadingMessage";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Separator } from "@/shared/ui/separator";
import { Toggle } from "@/shared/ui/toggle";
import {
  useDocument,
  useDocumentContent,
  openDocument,
  useSaveDocument,
} from "@/features/editor/document";
import { useEditorMode } from "@/features/editor/mode";
import { useIsMobile } from "@/shared/useMediaQuery";
import { parseFrontMatter } from "./frontMatter";
import { useGists } from "@/features/gists/queries";
import { getFileDisplayName, getMarkdownFiles } from "@/shared/github";
import { usePreferences } from "@/features/account/queries";
import {
  aiStore,
  showPendingAiDiffsAtom,
  updateAiState,
  useIsAiInProgress,
  useRunningMode,
  type AiAnswer,
} from "./store";
import { editorStatusAtom, editorViewAtom, useDraft } from "@/features/editor/store";
import { Chunk, getChunks, rejectChunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { useSelector } from "@tanstack/react-store";
import { cn } from "cn";
import {
  BookOpen,
  Check,
  CircleStop,
  Clipboard,
  ClipboardList,
  Diff,
  FileText,
  Globe,
  Lightbulb,
  Loader2,
  Maximize,
  MessageCircleQuestion,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  SendHorizonal,
  Settings,
  Settings2,
  Telescope,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CommandInput } from "./CommandInput";
import {
  expandCustomCommand,
  getModeSettings,
  parseGlobalFrontMatter,
  type ActionBarMode,
} from "./commands";
import ActionBarSettingsDialog from "./dialogs/ActionBarSettingsDialog";
import AnalyzeStyleDialog from "./dialogs/AnalyzeStyleDialog";
import ModelSettingsDialog from "./dialogs/ModelSettingsDialog";
import { FollowUpButton } from "./FollowUpButton";
import type { AiCommands } from "./useAiCommands";
import type { VoiceConversation } from "./voice/useVoiceConversation";

// Each mode's icon, label and command input placeholder (and when there's a selection, if it differs).
const MODES: Record<
  ActionBarMode,
  { icon: LucideIcon; label: string; placeholder: string; selectionPlaceholder?: string }
> = {
  auto: { icon: Lightbulb, label: "Auto", placeholder: "What would you like to know or do?" },
  talk: { icon: Mic, label: "Talk", placeholder: "Ask a question or propose a change..." },
  ask: {
    icon: MessageCircleQuestion,
    label: "Ask",
    placeholder: "What would you like to know?",
    selectionPlaceholder: "What question do you have about the selection?",
  },
  edit: {
    icon: Pencil,
    label: "Edit",
    placeholder: "What change would you like to make?",
    selectionPlaceholder: "How should we edit the selection?",
  },
  review: {
    icon: ClipboardList,
    label: "Review",
    placeholder: "What would you like to review?",
    selectionPlaceholder: "How should we review the selection?",
  },
  research: {
    icon: Telescope,
    label: "Research",
    placeholder: "What would you like to research?",
    selectionPlaceholder: "How should we research the selection?",
  },
};

// The modes that are available when a document is open (or not), where `null` is a separator.
const DOCUMENT_MODES: (ActionBarMode | null)[] = [
  "auto",
  "talk",
  null,
  "ask",
  "edit",
  null,
  "review",
  "research",
];
const GLOBAL_MODES: (ActionBarMode | null)[] = ["auto", null, "ask", "research"];

type Dialog = "document-settings" | "global-settings" | "model-settings" | "analyze-style";

const PANEL_CLASSES =
  "translate-y-[5px] bg-card/95 backdrop-blur-sm border border-border/50 shadow-2xl dark:shadow-dark-xl w-full";

const ROUND_BUTTON_CLASSES =
  "text-muted-foreground hover:text-foreground bg-background/80 hover:bg-background backdrop-blur-sm rounded-full p-1.5 transition-all duration-200 hover:scale-110 shadow-sm";

/** The answer to an "ask" command (which is displayed above the action bar). */
function AnswerPanel({
  answer,
  isExpanded,
  onToggleExpanded,
  onRun,
  className,
}: {
  answer: AiAnswer;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRun: (command: string) => void;
  className: string;
}) {
  const isMobile = useIsMobile();
  const isAiInProgress = useIsAiInProgress();
  const { gists } = useGists();
  const contentRef = useRef<HTMLDivElement>(null);
  const [canExpand, setCanExpand] = useState(false);

  // Keep the end of the answer in view, as it streams in.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [answer.text, answer.followUp?.question]);

  return (
    <div className={`absolute w-full animate-in slide-in-from-bottom-2 duration-300 ${className}`}>
      <div
        className={`${PANEL_CLASSES} ${isExpanded ? "" : "rounded-b-none "}rounded-xl relative overflow-hidden transition-all duration-300 hover:border-border/70`}
      >
        {!isAiInProgress && (
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
              onClick={() => updateAiState({ answer: null })}
              className={ROUND_BUTTON_CLASSES}
              aria-label="Close AI response"
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
              <MarkdownPreview gists={gists} onOpenGist={openDocument} isReadOnly>
                {answer.text}
              </MarkdownPreview>
              {answer.followUp?.question && (
                <FollowUpButton
                  question={answer.followUp.question}
                  onClick={() => onRun(answer.followUp!.topic)}
                  className="mt-6 mb-1"
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <AiLoadingMessage
                reasoningSummary={answer.reasoningSummary}
                isWebSearching={answer.isWebSearching}
                showCompactDetails
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Counts the lines that were added and deleted between two versions of a document. */
function getDiffStats(original: string, updated: string) {
  const a = Text.of(original.split(/\r?\n/));
  const b = Text.of(updated.split(/\r?\n/));
  const countLines = (text: Text, from: number, to: number) =>
    from === to ? 0 : text.lineAt(to - 1).number - text.lineAt(from).number + 1;

  let additions = 0;
  let deletions = 0;
  for (const chunk of Chunk.build(a, b)) {
    additions += countLines(b, chunk.fromB, chunk.toB);
    deletions += countLines(a, chunk.fromA, chunk.toA);
  }

  return { additions, deletions };
}

/** Rejects all of the AI's pending edits (which ends the edit conversation, since its edits are gone). */
function rejectEdits() {
  const view = editorViewAtom.get();
  if (!view) return;

  for (const chunk of getChunks(view.state)?.chunks.toReversed() ?? []) {
    rejectChunk(view, chunk.fromB);
  }

  updateAiState({ edit: null });
}

/** Accepts (i.e. saves) or rejects the AI's pending edits to the document. */
function EditPanel({ isRounded }: { isRounded: boolean }) {
  const doc = useDocument();
  const content = useDocumentContent(doc);
  const hasPendingAiEdit = !!useDraft(doc)?.hasPendingAiEdit;
  const save = useSaveDocument(doc);
  const showDiffs = useSelector(showPendingAiDiffsAtom);
  const isInProgress = useRunningMode() === "edit";
  const stats = hasPendingAiEdit ? getDiffStats(doc.savedContent, content) : null;

  return (
    <div className="absolute bottom-full w-full animate-in slide-in-from-bottom-2 duration-300">
      <div
        className={`${PANEL_CLASSES} ${isRounded ? "rounded-xl" : ""} flex items-center justify-between p-2 pb-3`}
      >
        <div className="flex gap-3 items-center">
          {isInProgress ? (
            <Loader2 className="h-4 w-4 animate-spin ml-1" />
          ) : (
            stats && (
              <div className="text-sm whitespace-nowrap flex items-center gap-2">
                <span className="text-green-400">+{stats.additions}</span>
                <span className="text-red-400">-{stats.deletions}</span>
              </div>
            )
          )}
          <Separator orientation="vertical" className="h-7!" />
          <Toggle
            variant="outline"
            size="sm"
            pressed={showDiffs}
            onPressedChange={(pressed) => showPendingAiDiffsAtom.set(pressed)}
            disabled={isInProgress}
            aria-label="Show changes"
          >
            <Diff />
          </Toggle>
        </div>
        <div className="flex gap-2">
          <Button
            size="xs"
            className="bg-green-500 hover:bg-green-400 text-white"
            onClick={save}
            disabled={isInProgress}
          >
            <Check /> Accept all
          </Button>
          <Button
            size="xs"
            className="bg-red-500 hover:bg-red-400 text-white"
            onClick={rejectEdits}
            disabled={isInProgress}
          >
            <X /> Reject all
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A floating bar for running AI commands against the open document (or the user's gists). */
export function ActionBar({ ai, voice }: { ai: AiCommands; voice: VoiceConversation }) {
  const doc = useDocument();
  const content = useDocumentContent(doc);
  const { gists } = useGists();
  const preferences = usePreferences();
  const [editorMode] = useEditorMode();
  const hasSelection = useSelector(editorStatusAtom, (status) => status.hasSelection);
  const draft = useDraft(doc);
  const answer = useSelector(aiStore, (state) => state.answer);
  const cancel = useSelector(aiStore, (state) => state.running?.cancel);
  const isAiInProgress = useIsAiInProgress() || voice.isAwaitingResponse;
  const isEditing = useRunningMode() === "edit";

  const [command, setCommand] = useState("");
  const [previousCommand, setPreviousCommand] = useState("");
  const [selectedMode, setSelectedMode] = useState<ActionBarMode>("auto");
  const [isExpanded, setIsExpanded] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Where focus moves once the mode menu closes: the command input (after selecting a mode),
  // nowhere (after opening a dialog, which takes focus), or else back to the menu's trigger.
  const menuFinalFocus = useRef<HTMLElement | boolean>(true);

  const hasDocument = !!doc.gistId;
  const mode: ActionBarMode = voice.isActive && hasDocument ? "talk" : selectedMode;
  const { frontMatter } = parseFrontMatter(content);
  const globalFrontMatter = parseGlobalFrontMatter(preferences);
  const commands = hasDocument
    ? getModeSettings(mode, frontMatter, globalFrontMatter).commands
    : [];

  const showEditPanel = (!!draft?.hasPendingAiEdit || isEditing) && editorMode !== "preview";

  // When there isn't an open document, the action bar is centered (rather than at the bottom)
  const isCentered = !hasDocument && answer === null;

  const run = (command: string, explicitMode?: ActionBarMode) => {
    setIsExpanded(false);

    const commandMode = explicitMode ?? mode;
    if (commandMode === "talk") return voice.sendCommand(command);

    // Custom commands are questions, unless they're run in a specific mode
    const customCommand = expandCustomCommand(command, commands);
    if (customCommand) return ai.run(customCommand, commandMode === "auto" ? "ask" : commandMode);

    return ai.run(command, commandMode);
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
    run(command);
  };

  const openDialog = (name: Dialog) => {
    menuFinalFocus.current = false;
    setDialog(name);
  };

  const closeDialog = () => setDialog(null);

  const { icon, placeholder, selectionPlaceholder = placeholder } = MODES[mode];
  const ModeIcon = voice.isActive && voice.isMicMuted ? MicOff : icon;

  return (
    <div
      className={`absolute left-1/2 z-50 w-[85%] -translate-x-1/2 transition-all ease-in-out duration-300 ${
        isExpanded ? "" : "max-w-[470px]"
      } ${isCentered ? "bottom-1/2 translate-y-5" : "bottom-5"}`}
    >
      {answer && (
        <AnswerPanel
          answer={answer}
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded(!isExpanded)}
          onRun={(command) => run(command, "ask")}
          className={showEditPanel ? "bottom-[92px]" : "bottom-full"}
        />
      )}

      {showEditPanel && <EditPanel isRounded={answer === null} />}

      <div
        className={`relative p-[2px] rounded-md bg-linear-to-r from-green-400 to-purple-600 ${
          isCentered ? "shadow-centered-action-bar" : "shadow-lg"
        } max-w-[470px] mx-auto transition-shadow duration-300 ease-in-out`}
      >
        <div className="bg-background rounded-md p-1 flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center justify-center px-2 hover:bg-muted rounded"
              aria-label="Select mode"
            >
              <ModeIcon
                className={cn(
                  "h-4 w-4",
                  voice.isActive && (voice.isMicMuted ? "text-red-500" : "text-green-500"),
                  voice.isActive && voice.whoIsSpeaking === "assistant" && "animate-pulse",
                )}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="mb-1"
              finalFocus={() => {
                const target = menuFinalFocus.current;
                menuFinalFocus.current = true;
                return target;
              }}
            >
              {voice.isActive ? (
                <>
                  <DropdownMenuItem onClick={voice.toggleMute}>
                    {voice.isMicMuted ? <MicOff /> : <Mic />}
                    {voice.isMicMuted ? "Unmute microphone" : "Mute microphone"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={voice.end}>
                    <MessageSquare /> End conversation
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  {(hasDocument ? DOCUMENT_MODES : GLOBAL_MODES).map((mode, index) => {
                    if (!mode) return <DropdownMenuSeparator key={index} />;

                    const { icon: Icon, label } = MODES[mode];
                    return (
                      <DropdownMenuItem
                        key={mode}
                        className={
                          mode === selectedMode ? "bg-primary text-primary-foreground" : ""
                        }
                        onClick={() => {
                          menuFinalFocus.current = inputRef.current ?? true;
                          if (mode === "talk") voice.start();
                          else setSelectedMode(mode);
                        }}
                      >
                        <Icon />
                        {label}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Settings /> Configure
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => openDialog("global-settings")}>
                        <Globe /> Global settings
                      </DropdownMenuItem>
                      {hasDocument && (
                        <DropdownMenuItem onClick={() => openDialog("document-settings")}>
                          <FileText /> Document settings
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openDialog("model-settings")}>
                        <Settings2 /> Model settings
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDialog("analyze-style")}
                        disabled={gists.length === 0}
                      >
                        <BookOpen /> Analyze writing style
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <CommandInput
            ref={inputRef}
            value={command}
            onValueChange={setCommand}
            onSubmit={submit}
            previousCommand={previousCommand}
            commands={hasSelection ? [] : commands}
            gists={gists.filter(({ id }) => id !== doc.gistId)}
            files={getMarkdownFiles(doc.gist)
              .filter((file) => file !== doc.filename)
              .map(getFileDisplayName)}
            placeholder={hasSelection ? selectionPlaceholder : placeholder}
            disabled={isAiInProgress}
          />

          <Button
            variant="ghost"
            onClick={isAiInProgress ? cancel : submit}
            disabled={isAiInProgress ? !cancel : !command.trim() && commands.length === 0}
            className={`rounded h-auto p-1! ${isAiInProgress && cancel ? "hover:text-white" : "hover:bg-muted"}`}
            aria-label={isAiInProgress ? "Cancel" : "Send"}
          >
            {!isAiInProgress ? (
              <SendHorizonal />
            ) : cancel ? (
              <CircleStop />
            ) : (
              <Loader2 className="animate-spin" />
            )}
          </Button>
        </div>
      </div>

      {dialog === "global-settings" && (
        <ActionBarSettingsDialog scope="global" onClose={closeDialog} />
      )}
      {dialog === "document-settings" && (
        <ActionBarSettingsDialog scope="document" onClose={closeDialog} />
      )}
      {dialog === "model-settings" && <ModelSettingsDialog onClose={closeDialog} />}
      {dialog === "analyze-style" && <AnalyzeStyleDialog gists={gists} onClose={closeDialog} />}
    </div>
  );
}
