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
  useOpenDocument,
  useSaveDocument,
} from "@/features/editor/document";
import { useEditorMode } from "@/features/editor/mode";
import { useIsMobile } from "@/shared/useMediaQuery";
import { parseFrontMatter, updateFrontMatter } from "@/shared/frontMatter";
import { useGists } from "@/features/gists/queries";
import {
  parseGlobalFrontMatter,
  usePreferences,
  useUpdatePreferences,
} from "@/features/account/queries";
import {
  aiStore,
  showPendingAiDiffsAtom,
  updateAiState,
  useAiEdit,
  useIsAiInProgress,
  useRunningMode,
  type AiAnswer,
} from "./store";
import { draftAtom, editorStatusAtom, updateDraft, useDraft } from "@/features/editor/store";
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
import { expandCustomCommand, getCustomCommands, type ActionBarMode } from "./commands";
import ActionBarSettingsDialog from "./dialogs/ActionBarSettingsDialog";
import AnalyzeStyleDialog from "./dialogs/AnalyzeStyleDialog";
import ConfigureAiDialog from "./dialogs/ConfigureAiDialog";
import { FollowUpButton } from "./FollowUpButton";
import type { AiCommands } from "./useAiCommands";
import type { VoiceConversation } from "./voice/useVoiceConversation";

const MODES: Record<ActionBarMode, { icon: LucideIcon; label: string }> = {
  auto: { icon: Lightbulb, label: "Auto" },
  talk: { icon: Mic, label: "Talk" },
  ask: { icon: MessageCircleQuestion, label: "Ask" },
  edit: { icon: Pencil, label: "Edit" },
  discuss: { icon: ClipboardList, label: "Review" },
  research: { icon: Telescope, label: "Research" },
};

// The modes that are available when a document is open (or not), where `null` is a separator.
const DOCUMENT_MODES: (ActionBarMode | null)[] = [
  "auto",
  "talk",
  null,
  "ask",
  "edit",
  null,
  "discuss",
  "research",
];
const GLOBAL_MODES: (ActionBarMode | null)[] = ["auto", null, "ask", "research"];

// The command input's placeholder in each mode (and when there's a selection, if it differs).
const PLACEHOLDERS: Record<ActionBarMode, [placeholder: string, selectionPlaceholder?: string]> = {
  auto: ["What would you like to know or do?"],
  talk: ["Ask a question or propose a change..."],
  ask: ["What would you like to know?", "What question do you have about the selection?"],
  edit: ["What change would you like to make?", "How should we edit the selection?"],
  discuss: ["What would you like to review?", "How should we review the selection?"],
  research: ["What would you like to research?", "How should we research the selection?"],
};

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
  const openDocument = useOpenDocument();
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

/** Accepts or rejects the AI's (pending) edits to the document. */
function EditPanel({ ai, isRounded }: { ai: AiCommands; isRounded: boolean }) {
  const doc = useDocument();
  const edit = useAiEdit(doc.documentKey);
  const showDiffs = useSelector(showPendingAiDiffsAtom);
  const isInProgress = useRunningMode() === "edit";

  return (
    <div className="absolute bottom-full w-full animate-in slide-in-from-bottom-2 duration-300">
      <div
        className={`${PANEL_CLASSES} ${isRounded ? "rounded-xl" : ""} flex items-center justify-between p-2 pb-3`}
      >
        <div className="flex gap-3 items-center">
          {isInProgress ? (
            <Loader2 className="h-4 w-4 animate-spin ml-1" />
          ) : (
            edit?.stats && (
              <div className="text-sm whitespace-nowrap flex items-center gap-2">
                <span className="text-green-400">+{edit.stats.additions}</span>
                <span className="text-red-400">-{edit.stats.deletions}</span>
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
            onClick={ai.acceptEdit}
            disabled={isInProgress}
          >
            <Check /> Accept all
          </Button>
          <Button
            size="xs"
            className="bg-red-500 hover:bg-red-400 text-white"
            onClick={ai.rejectEdit}
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
  const updatePreferences = useUpdatePreferences();
  const save = useSaveDocument(doc);
  const [editorMode] = useEditorMode();
  const hasSelection = useSelector(editorStatusAtom, (status) => status.hasSelection);
  const draft = useDraft(doc.documentKey);
  const edit = useAiEdit(doc.documentKey);
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
  const commands = hasDocument ? getCustomCommands(mode, frontMatter, globalFrontMatter) : [];

  const showEditPanel =
    (!!draft?.hasPendingAiEdit || (isEditing && !!edit)) && editorMode !== "preview";

  // When there isn't an open document, the action bar is centered (rather than at the bottom)
  const isCentered = !hasDocument && answer === null;

  const run = (command: string, explicitMode?: ActionBarMode) => {
    setIsExpanded(false);

    const commandMode = explicitMode ?? mode;
    if (commandMode === "talk") return voice.sendCommand(command);

    const customCommand = expandCustomCommand(command, commands);
    if (customCommand) {
      return ai.run(customCommand, commandMode === "auto" ? "ask" : commandMode);
    }

    // When the user is iterating on an edit (or an answer), then follow-up
    // commands are likely to be the same kind of action.
    const suspectedMode = draft?.hasPendingAiEdit
      ? "edit"
      : answer !== null || !hasDocument
        ? "ask"
        : undefined;

    return ai.run(command, commandMode, { suspectedMode });
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

  const dialogProps = (name: Dialog) => ({
    isOpen: dialog === name,
    onOpenChange: (open: boolean) => setDialog(open ? name : null),
  });

  const ModeIcon = voice.isActive && voice.isMicMuted ? MicOff : MODES[mode].icon;
  const [placeholder, selectionPlaceholder = placeholder] = PLACEHOLDERS[mode];

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

      {showEditPanel && <EditPanel ai={ai} isRounded={answer === null} />}

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
            files={Object.keys(doc.gist?.files ?? {})
              .filter((file) => file !== doc.filename && file.endsWith(".md"))
              .map((file) => file.replace(/\.md$/, ""))}
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

      <ActionBarSettingsDialog
        {...dialogProps("global-settings")}
        scope="global"
        frontMatter={globalFrontMatter}
        onSave={(frontMatter) =>
          updatePreferences({ globalFrontMatter: JSON.stringify(frontMatter) })
        }
      />
      <ActionBarSettingsDialog
        {...dialogProps("document-settings")}
        scope="document"
        frontMatter={frontMatter ?? {}}
        onSave={(frontMatter) => {
          // If the document didn't have unsaved changes, then save the settings right away.
          const hadChanges = !!draftAtom.get();
          updateDraft(doc.documentKey, doc.savedContent, {
            content: updateFrontMatter(content, frontMatter),
          });
          if (!hadChanges && !doc.isReadOnly) save();
        }}
      />
      <ConfigureAiDialog {...dialogProps("model-settings")} />
      <AnalyzeStyleDialog {...dialogProps("analyze-style")} gists={gists} />
    </div>
  );
}
