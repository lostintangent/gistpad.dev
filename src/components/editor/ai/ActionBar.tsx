import { classifyAction } from "@/agents/classify";
import { AgentFollowUp } from "@/agents/openai";
import { editorModeAtom } from "@/atoms";
import { AiLoadingMessage } from "@/components/AiLoadingMessage";
import AnalyzeStyleDialog from "@/components/editor/ai/dialogs/AnalyzeStyleDialog";
import ConfigureAiDialog from "@/components/editor/ai/dialogs/ConfigureAiDialog";
import ConfigureActionBarDialog from "@/components/editor/ai/dialogs/ConfigureDialog";
import ScrollableContainer from "@/components/editor/ai/ScrollableContainer";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { useIsMobile } from "@/hooks/useMobile";
import { Gist, getGistDisplayName } from "@/lib/github";
import { formatDistanceToNow } from "date-fns";
import { useAtomValue } from "jotai";
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
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FollowUpButton } from "./FollowUpButton";

type ModeType = "ask" | "edit" | "discuss" | "research" | "talk" | "auto";

export interface Command {
  name: string;
  description: string;
  prompt?: string;
  isGlobal?: boolean;
}

export const ActionBar = ({
  isCommandInProgress,
  onSubmitCommand,
  isVoiceActive = false,
  startVoiceConversation,
  muteMicrophone,
  endConversation,
  hasSelection = false,
  isMicMuted = false,
  whoIsSpeaking = null,
  getFrontmatter,
  updateFrontmatter,
  getGlobalFrontmatter,
  updateGlobalFrontMatter,
  isAiEnabled = false,
  onSaveAiSettings,
  gists = [],
  gistFiles = [],
  aiResponse = null,
  aiFollowUp = null,
  reasoningSummary,
  isWebSearching = false,
  onCloseAiResponse,
  cancelCommand,
  hasSelectedGist = true,
  onSelectGist,
  hasPendingAiEdit = false,
  onAcceptAiEdit,
  onRejectAiEdit,
  showPendingAiDiffs = true,
  onTogglePendingAiDiffs,
  aiEditStats,
  isAiEditInProgress = false,
  isLoading = false,
  fileContents = "",
}: {
  isCommandInProgress: boolean;
  onSubmitCommand: (command: string, mode: ModeType) => void;
  isVoiceActive?: boolean;
  startVoiceConversation?: () => void;
  muteMicrophone?: () => void;
  endConversation?: () => void;
  hasSelection?: boolean;
  isMicMuted?: boolean;
  whoIsSpeaking?: "user" | "assistant" | null;
  getFrontmatter: () => Record<string, unknown> | null;
  updateFrontmatter: (newFrontmatter: Record<string, unknown>) => void;
  getGlobalFrontmatter?: () => Record<string, unknown> | null;
  updateGlobalFrontMatter?: (newFrontmatter: Record<string, unknown>) => void;
  isAiEnabled?: boolean;
  onSaveAiSettings: (
    apiKey: string,
    askModel: string,
    reviewModel: string,
    editModel: string,
    researchModel: string,
    showReasoningSummaries: boolean
  ) => void;
  gists?: Gist[];
  gistFiles?: string[];
  aiResponse?: string | null;
  aiFollowUp?: AgentFollowUp | null;
  reasoningSummary?: string;
  isWebSearching?: boolean;
  onCloseAiResponse?: () => void;
  cancelCommand?: () => void;
  hasSelectedGist?: boolean;
  onSelectGist?: (gistId: string) => void;
  hasPendingAiEdit?: boolean;
  onAcceptAiEdit?: () => void;
  onRejectAiEdit?: () => void;
  showPendingAiDiffs?: boolean;
  onTogglePendingAiDiffs?: () => void;
  aiEditStats?: { additions: number; deletions: number; hunks: number };
  isAiEditInProgress?: boolean;
  isLoading?: boolean;
  fileContents?: string;
}) => {
  const editorMode = useAtomValue(editorModeAtom);
  const isPreviewMode = editorMode === "preview";

  const isFileEmpty = !isLoading && (fileContents?.length ?? 0) < 3000;

  const [commandText, setCommandText] = useState("");
  const [lastSubmittedCommand, setLastSubmittedCommand] = useState<string>("");
  const [currentMode, setCurrentMode] = useState<ModeType>(() => "auto");
  const [isConfigureDialogOpen, setIsConfigureDialogOpen] = useState(false);
  const [isGlobalConfigureDialogOpen, setIsGlobalConfigureDialogOpen] =
    useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);

  const isMobile = useIsMobile();

  const [showCompletionList, setShowCompletionList] = useState(false);
  const [completionListType, setCompletionListType] = useState<
    "command" | "gist" | "file" | null
  >(null);
  const [completionListFilter, setCompletionListFilter] = useState("");
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);

  const [commands, setCommands] = useState<Command[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const [textareaHeight, setTextareaHeight] = useState<number | undefined>(
    undefined
  );

  const HIGHLIGHT_REGEX = /([@#])\[([^\]]+)]/g;

  interface Reference {
    start: number;
    end: number;
  }

  const escapeHtml = (text: string) => text;
  //text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const parseAndRender = useCallback((text: string) => {
    const parts: string[] = [];
    const refs: Reference[] = [];
    let lastIndex = 0;
    for (const match of text.matchAll(HIGHLIGHT_REGEX)) {
      const index = match.index ?? 0;
      const [fullMatch, symbol, contents] = match;
      parts.push(escapeHtml(text.slice(lastIndex, index)));
      // Replace the square brackets with an invisible span, so the
      // reference markers are more readable. But we leave the
      // brackets "behind the scenes", so that it's easier to
      // delineate the reference and adjacent text.
      const highlightedText = `${symbol}<span class="invisible">[</span>${contents}<span class="invisible">]</span>`;
      parts.push(
        `<span class="text-blue-100 bg-blue-700 rounded pointer-events-none select-none">${escapeHtml(highlightedText)}</span>`
      );
      refs.push({ start: index, end: index + fullMatch.length });
      lastIndex = index + fullMatch.length;
    }
    parts.push(escapeHtml(text.slice(lastIndex)));

    return { html: parts.join(""), refs };
  }, []);

  const { html: highlightedCommandText, refs: references } = useMemo(
    () => parseAndRender(commandText),
    [commandText, parseAndRender]
  );

  const getModeIcon = () => {
    const baseStyles = "h-4 w-4";
    const pulseClass =
      isVoiceActive && whoIsSpeaking === "assistant" ? "animate-pulse" : "";
    if (currentMode === "talk") {
      return isVoiceActive ? (
        isMicMuted ? (
          <MicOff className={`${baseStyles} text-red-500 ${pulseClass}`} />
        ) : (
          <Mic className={`${baseStyles} text-green-500 ${pulseClass}`} />
        )
      ) : (
        <Mic className={baseStyles} />
      );
    }

    return currentMode === "edit" ? (
      <Pencil className={baseStyles} />
    ) : currentMode === "research" ? (
      <Telescope className={baseStyles} />
    ) : currentMode === "auto" ? (
      <Lightbulb className={baseStyles} />
    ) : currentMode === "ask" ? (
      <MessageCircleQuestion className={baseStyles} />
    ) : (
      <ClipboardList className={baseStyles} />
    );
  };

  const computeCommands = () => {
    if (!hasSelectedGist || currentMode === "research") return [];

    const frontMatter = getFrontmatter() as any;
    const globalFrontMatter = (getGlobalFrontmatter?.() || {}) as any;
    let commands: Command[] = [];

    // If we're in discuss mode and there are discussion commands, use those instead
    if (
      currentMode === "discuss" ||
      currentMode === "ask" ||
      currentMode === "auto"
    ) {
      const overridesGlobalSettings =
        frontMatter?.discuss?.overridesGlobalSettings === true;
      if (!overridesGlobalSettings && globalFrontMatter.discuss?.commands) {
        commands = Object.entries(globalFrontMatter.discuss.commands).map(
          ([name, value]) => ({
            name,
            description: value,
            prompt: value,
            isGlobal: true,
          })
        ) as Command[];
      }

      // Add document-specific discuss commands if available
      if (frontMatter?.discuss?.commands) {
        const docCommands = Object.entries(frontMatter.discuss.commands).map(
          ([name, value]) => ({
            name,
            description: value,
            prompt: value,
            isGlobal: false,
          })
        ) as Command[];

        // Merge commands, giving precedence to document commands
        const existingNames = new Set(commands.map((cmd) => cmd.name));
        for (const cmd of docCommands) {
          if (!existingNames.has(cmd.name)) {
            commands.push(cmd);
          }
        }
      }

      commands.sort((a, b) => a.name.localeCompare(b.name));
      return commands;
    }

    const overridesGlobalSettings =
      frontMatter?.edit?.overridesGlobalSettings === true;
    if (!overridesGlobalSettings && globalFrontMatter.edit?.commands) {
      if (typeof globalFrontMatter.edit.commands === "object") {
        commands = Object.entries(globalFrontMatter.edit.commands).map(
          ([name, value]) => {
            if (typeof value === "string") {
              return {
                name,
                description: value,
                prompt: value,
                isGlobal: true,
              } as Command;
            }
            // Type check the command object
            const cmdObj = value as Command;
            return {
              name,
              description: cmdObj.description || "",
              prompt: cmdObj.prompt,
              isGlobal: true,
            } as Command;
          }
        );
      }
    }

    // Then add document-specific edit commands if available
    if (
      frontMatter?.edit?.commands &&
      typeof frontMatter.edit.commands === "object"
    ) {
      const docCommands = Object.entries(frontMatter.edit.commands).map(
        ([name, value]) => {
          if (typeof value === "string") {
            return {
              name,
              description: value,
              prompt: value,
              isGlobal: false,
            } as Command;
          }
          // Type check the command object
          const cmdObj = value as Command;
          return {
            name,
            description: cmdObj.description || "",
            prompt: cmdObj.prompt,
            isGlobal: false,
          } as Command;
        }
      );

      // Merge commands, giving precedence to document commands
      const existingNames = new Set(commands.map((cmd) => cmd.name));
      for (const cmd of docCommands) {
        if (!existingNames.has(cmd.name)) {
          commands.push(cmd);
        }
      }
    }

    commands.sort((a, b) => a.name.localeCompare(b.name));
    return commands;
  };

  // Automatically filter the commands list as the
  // the user types in the input field.
  const sortedGists = useMemo(() => {
    return [...gists].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [gists]);

  const filterCompletionItems = useMemo(() => {
    if (completionListType === "gist") {
      const searchTerm = completionListFilter.toLowerCase();
      return sortedGists.filter((g) =>
        getGistDisplayName(g).toLowerCase().includes(searchTerm)
      );
    } else if (completionListType === "file") {
      const searchTerm = completionListFilter.toLowerCase();
      return gistFiles.filter((f) => f.toLowerCase().includes(searchTerm));
    }

    if (!completionListFilter || !completionListFilter.startsWith("/"))
      return commands;

    const searchTerm = completionListFilter.slice(1).toLowerCase();
    return commands.filter(
      (cmd) => !searchTerm || cmd.name.toLowerCase().startsWith(searchTerm)
    );
  }, [
    completionListType,
    commands,
    completionListFilter,
    sortedGists,
    gistFiles,
  ]);

  const renderCommandName = useCallback(
    (name: string) => {
      const displayName = `/${name}`;

      if (completionListType !== "command") {
        return <span className="font-medium">{displayName}</span>;
      }

      const filterText = completionListFilter;
      if (!filterText) {
        return <span className="font-medium">{displayName}</span>;
      }

      const lowerName = displayName.toLowerCase();
      const lowerFilter = filterText.toLowerCase();

      if (!lowerName.startsWith(lowerFilter)) {
        return <span className="font-medium">{displayName}</span>;
      }

      const prefix = displayName.slice(0, filterText.length);
      const suffix = displayName.slice(filterText.length);

      return (
        <span className="font-medium">
          <span className="text-blue-500">{prefix}</span>
          {suffix}
        </span>
      );
    },
    [completionListFilter, completionListType]
  );

  // Update the list/filter whenever
  // the user types in the input field.
  useEffect(() => {
    const textarea = inputRef.current;
    const cursorPos = textarea
      ? textarea.selectionStart || 0
      : commandText.length;
    const beforeCursor = commandText.slice(0, cursorPos);

    const slashMatch = beforeCursor.match(/\/[^\s]*$/);
    const atMatch = beforeCursor.match(/@([^\s]*)$/);
    const hashMatch = beforeCursor.match(/#([^\s]*)$/);

    if (slashMatch && currentMode !== "research" && !hasSelection) {
      setCompletionListType("command");
      setCompletionListFilter(slashMatch[0]);
      if (slashMatch[0] === "/" && commands.length > 0) {
        setShowCompletionList(true);
      } else {
        setShowCompletionList(true);
      }
      return;
    }

    if (atMatch) {
      setCompletionListType("gist");
      setCompletionListFilter(atMatch[1]);
      setShowCompletionList(true);
      return;
    }

    if (hashMatch) {
      setCompletionListType("file");
      setCompletionListFilter(hashMatch[1]);
      setShowCompletionList(true);
      return;
    }

    setShowCompletionList(false);
    setCompletionListType(null);
  }, [commandText, currentMode, hasSelection, commands]);

  // Automatically clear the command list
  // filter/selection whenever the command list is closed.
  useEffect(() => {
    if (!showCompletionList) {
      setCompletionListFilter("");
      setSelectedCompletionIndex(0);
      setCompletionListType(null);
    }
  }, [showCompletionList]);

  // Compute commands when the component mounts or mode changes
  useEffect(() => {
    const availableCommands = computeCommands();
    setCommands(availableCommands);
    setIsExpanded(false);
    // TODO: Replace this with a better solution that detects when the commands list has been updated
  }, [currentMode, getFrontmatter, getGlobalFrontmatter]);

  // Adjust textarea height based on content and sync highlight div
  useEffect(() => {
    const textarea = inputRef.current;
    const highlightDiv = highlightRef.current;
    if (!textarea || !highlightDiv) return;

    // This is needed to allow the browser to recalculate the
    // actual scrollheight of the text area before we compute it.
    textarea.style.height = "auto";

    if (commandText.trim() === "") {
      setTextareaHeight(undefined);
      return;
    }

    const lineHeight = parseInt(
      window.getComputedStyle(textarea).lineHeight,
      10
    );

    const maxHeight = lineHeight * 3 + 8; // 3 lines + padding
    const calculatedHeight = Math.min(maxHeight, textarea.scrollHeight);

    setTextareaHeight(calculatedHeight);
    textarea.style.height = `${calculatedHeight}px`;
  }, [commandText]);

  // Sync scroll position between textarea and highlight div
  const handleScroll = useCallback(() => {
    const textarea = inputRef.current;
    const highlightDiv = highlightRef.current;
    if (textarea && highlightDiv) {
      highlightDiv.scrollTop = textarea.scrollTop;
    }
  }, []);

  // Shared function to submit a command
  const submitCommand = useCallback(
    async (
      commandContent: string,
      mode?: ModeType,
      persistCommand: boolean = true
    ) => {
      if (persistCommand) {
        setLastSubmittedCommand(commandContent);
      }
      setIsExpanded(false);

      // Check for slash commands first, before attempting to classify the action
      if (commandContent.startsWith("/")) {
        const commandName = commandContent.split(" ")[0];
        const selectedCommand = commands.find(
          (cmd) => cmd.name === commandName.substring(1)
        );

        if (selectedCommand && selectedCommand.prompt) {
          // Get the text after the command
          const userInput = commandContent
            .substring(commandName.length + 1)
            .trim();
          // Construct the full prompt using the command's prompt template and user input
          const fullPrompt = `${selectedCommand.prompt}${userInput ? `: ${userInput}` : ""}`;

          // TODO: Classify the intent of the command's prompt
          onSubmitCommand(fullPrompt, "ask");
          return;
        }
      }

      // For non-slash commands, handle auto mode classification
      let effectiveMode = currentMode;
      if (currentMode === "auto") {
        if (mode) {
          effectiveMode = mode;
        } else {
          // If the user is actively working on a series of edits,
          // then we suspect that subsequent commands are also edits.
          const suspectedAction = hasPendingAiEdit
            ? "edit"
            : aiResponse !== null || !hasSelectedGist
              ? "ask"
              : undefined;

          // Detect the user's intent based on their request and current context
          const result = await classifyAction(
            commandContent,
            hasSelectedGist,
            suspectedAction
          );
          effectiveMode = result as ModeType;
        }
      }

      onSubmitCommand(commandContent, effectiveMode);
    },
    [commands, currentMode, onSubmitCommand, hasPendingAiEdit, hasSelectedGist]
  );

  useEffect(() => {
    if (isVoiceActive && hasSelectedGist) {
      setCurrentMode("talk");
    } else {
      setCurrentMode("auto");
    }
  }, [isVoiceActive, hasSelectedGist]);

  function focusEndOfInput() {
    const textarea = inputRef.current;
    setTimeout(() => {
      textarea.focus();
      textarea.scrollTop = textarea.scrollHeight;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 0);
  }

  const handleCommandSelect = (command: Command) => {
    if (!commandText.trim()) {
      // If input was empty, directly submit the command. And if the current
      // mode is auto, then we assume that this is a question.
      submitCommand(command.prompt, currentMode === "auto" ? "ask" : undefined);
    } else {
      setCommandText(`/${command.name} `);
      focusEndOfInput();
    }

    setShowCompletionList(false);
  };

  const replaceMatch = (
    match: RegExpMatchArray | null,
    replacement: string
  ) => {
    if (!match) return;
    const textarea = inputRef.current;
    const cursorPos = textarea
      ? textarea.selectionStart || 0
      : commandText.length;
    const startIdx = cursorPos - match[0].length;
    const newText =
      commandText.slice(0, startIdx) +
      replacement +
      commandText.slice(cursorPos);
    setCommandText(newText);
    setShowCompletionList(false);
    focusEndOfInput();
  };

  const handleGistSelect = (gist: Gist) => {
    const textarea = inputRef.current;
    const cursorPos = textarea
      ? textarea.selectionStart || 0
      : commandText.length;

    const beforeCursor = commandText.slice(0, cursorPos);
    const match = beforeCursor.match(/@([^\s]*)$/);

    const text = `@[${getGistDisplayName(gist)}] `;
    replaceMatch(match, text);
  };

  const handleFileSelect = (filename: string) => {
    const textarea = inputRef.current;
    const cursorPos = textarea
      ? textarea.selectionStart || 0
      : commandText.length;

    const beforeCursor = commandText.slice(0, cursorPos);
    const match = beforeCursor.match(/#([^\s]*)$/);
    const text = `#[${filename}] `;
    replaceMatch(match, text);
  };

  const handleSendText = useCallback(async () => {
    if (!commandText.trim()) {
      // If text is empty and command list is shown, hide it
      if (showCompletionList) {
        setCompletionListType(null);
        setShowCompletionList(false);
      }
      // If text is empty and command list is not shown, show it if there are commands
      else if (commands.length > 0) {
        setShowCompletionList(true);
        setCompletionListType("command");
      }
      return;
    }

    submitCommand(commandText);
    setCommandText("");
    setTextareaHeight(undefined);
  }, [commandText, submitCommand, commands, showCompletionList]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // If the command list is showing, then we treat
      // the key press as a command list operation.
      if (showCompletionList && filterCompletionItems.length > 0) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedCompletionIndex(
              (prev) => (prev + 1) % filterCompletionItems.length
            );
            break;
          case "ArrowUp":
            e.preventDefault();
            setSelectedCompletionIndex((prev) =>
              prev - 1 < 0 ? filterCompletionItems.length - 1 : prev - 1
            );
            break;
          case "Enter":
          case "Tab": {
            e.preventDefault();
            const selectedItem =
              filterCompletionItems[selectedCompletionIndex] ||
              filterCompletionItems[0];
            if (completionListType === "command") {
              handleCommandSelect(selectedItem as Command);
            } else if (completionListType === "gist") {
              handleGistSelect(selectedItem as Gist);
            } else if (completionListType === "file") {
              handleFileSelect(selectedItem as string);
            }
            break;
          }
          case "Escape":
            e.preventDefault();
            setShowCompletionList(false);
            break;
        }
        return;
      }

      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowLeft" ||
        e.key === "Backspace" ||
        e.key === "Delete"
      ) {
        const textarea = e.currentTarget;
        const pos = textarea.selectionStart || 0;
        if (e.key === "ArrowRight") {
          const ref = references.find((r) => r.start === pos);
          if (ref) {
            e.preventDefault();
            textarea.setSelectionRange(ref.end, ref.end);
            return;
          }
        } else if (e.key === "ArrowLeft") {
          const ref = references.find((r) => r.end === pos);
          if (ref) {
            e.preventDefault();
            textarea.setSelectionRange(ref.start, ref.start);
            return;
          }
        } else if (e.key === "Backspace") {
          // For backspace, check if cursor is at the end of a reference
          const ref = references.find((r) => r.end === pos);
          if (ref) {
            e.preventDefault();
            const newText =
              commandText.slice(0, ref.start) + commandText.slice(ref.end);
            setCommandText(newText);
            setTimeout(() => {
              textarea.setSelectionRange(ref.start, ref.start);
            }, 0);
            return;
          }
        } else if (e.key === "Delete") {
          // For delete, check if cursor is at the start of a reference
          const ref = references.find((r) => r.start === pos);
          if (ref) {
            e.preventDefault();
            const newText =
              commandText.slice(0, ref.start) + commandText.slice(ref.end);
            setCommandText(newText);
            setTimeout(() => {
              textarea.setSelectionRange(ref.start, ref.start);
            }, 0);
            return;
          }
        }
      }

      if (
        e.key === "ArrowUp" &&
        !showCompletionList &&
        commandText.trim() === "" &&
        lastSubmittedCommand
      ) {
        e.preventDefault();
        setCommandText(lastSubmittedCommand);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSendText();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setCommandText("");
        setTextareaHeight(undefined);
      }
    },
    [
      showCompletionList,
      filterCompletionItems,
      selectedCompletionIndex,
      handleCommandSelect,
      handleGistSelect,
      handleFileSelect,
      handleSendText,
      lastSubmittedCommand,
      completionListType,
      commandText,
      references,
    ]
  );

  // Automatically scroll to bottom of AI response when it changes
  useEffect(() => {
    if (
      (aiResponse !== null || aiFollowUp?.question !== null) &&
      aiResponseRef.current
    ) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
  }, [aiResponse, aiFollowUp?.question]);

  const [isExpanded, setIsExpanded] = useState(false);

  // If the user doesn't have a gist selected, then we want
  // to center the action bar vs. placing it at the bottom.
  const isCentered = !hasSelectedGist && aiResponse === null;

  const showEditPanel =
    (hasPendingAiEdit || isAiEditInProgress) && !isPreviewMode;

  return (
    <div
      className={"transition-all ease-in-out duration-300"}
      style={{
        position: "absolute",
        left: "50%",
        width: "85%",
        ...(isExpanded ? {} : { maxWidth: "470px" }),
        zIndex: 50,
        ...(isCentered
          ? {
            bottom: "50%",
            transform: "translate(-50%, 20px)",
          }
          : {
            bottom: "20px",
            transform: "translateX(-50%)",
          }),
      }}
    >
      {/* Ask response UI */}
      {aiResponse !== null && (
        <div
          className={`absolute ${showEditPanel ? "bottom-[92px]" : "bottom-full"} w-full animate-in slide-in-from-bottom-2 duration-300`}
        >
          <div
            className={`${!isExpanded ? "rounded-b-none " : ""}translate-y-[5px] bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-2xl dark:shadow-dark-xl w-full relative overflow-hidden transition-all duration-300 hover:border-border/70`}
          >
            {/* Close button / menu button / reasoning summary */}
            <div className="absolute top-3 right-3 z-10 flex gap-2">
              {!isCommandInProgress && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="text-muted-foreground hover:text-foreground bg-background/80 hover:bg-background backdrop-blur-sm rounded-full p-1.5 transition-all duration-200 hover:scale-110 shadow-sm"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isMobile &&
                        (isExpanded ||
                          aiResponseRef.current?.scrollHeight >
                          aiResponseRef.current?.clientHeight) && (
                          <DropdownMenuItem
                            onClick={() => setIsExpanded((v) => !v)}
                          >
                            {isExpanded ? (
                              <>
                                <Minimize className="h-4 w-4 mr-2" /> Collapse
                              </>
                            ) : (
                              <>
                                <Maximize className="h-4 w-4 mr-2" /> Expand
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                      <DropdownMenuItem
                        onClick={() =>
                          aiResponse &&
                          navigator.clipboard.writeText(aiResponse)
                        }
                      >
                        <Clipboard className="h-4 w-4 mr-2" /> Copy contents
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => submitCommand("Try again", "ask", false)}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" /> Try again
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={onCloseAiResponse}
                    className="text-muted-foreground hover:text-foreground bg-background/80 hover:bg-background backdrop-blur-sm rounded-full p-1.5 transition-all duration-200 hover:scale-110 shadow-sm"
                    aria-label="Close AI response"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {/* Content area */}
            <ScrollableContainer
              ref={aiResponseRef}
              containerClassName={`${isExpanded ? "max-h-[75vh]" : "max-h-[60vh]"} ${aiResponse ? "p-4 pr-12" : ""}`}
            >
              {aiResponse === "" ? (
                <div className="flex items-center justify-center py-8">
                  <AiLoadingMessage
                    reasoningSummary={reasoningSummary}
                    isWebSearching={isWebSearching}
                    showCompactDetails={true}
                  />
                </div>
              ) : (
                <>
                  {/* Markdown content */}
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-m-20 prose-p:leading-relaxed prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted/50">
                    <MarkdownPreview
                      gists={gists}
                      onSelectGist={onSelectGist}
                      isReadonly={true}
                    >
                      {aiResponse}
                    </MarkdownPreview>
                  </div>
                  {aiFollowUp?.question && (
                    <FollowUpButton
                      question={aiFollowUp.question}
                      onClick={() => submitCommand(aiFollowUp.topic, "ask")}
                      className="mt-6 mb-1"
                    />
                  )}
                </>
              )}
            </ScrollableContainer>
          </div>
        </div>
      )}

      {/* Edit command panel */}
      {showEditPanel && (
        <div className="absolute bottom-full w-full animate-in slide-in-from-bottom-2 duration-300">
          <div
            className={`translate-y-[5px] bg-card/95 backdrop-blur-sm border border-border/50 ${aiResponse === null ? "rounded-xl" : ""} shadow-2xl dark:shadow-dark-xl w-full flex items-center justify-between p-2 pb-3`}
          >
            <div className="flex gap-3 items-center">
              {isAiEditInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                aiEditStats && (
                  <div className="text-sm whitespace-nowrap flex items-center gap-2">
                    <span className="text-green-400">
                      +{aiEditStats.additions}
                    </span>
                    <span className="text-red-400">
                      -{aiEditStats.deletions}
                    </span>
                  </div>
                )
              )}

              <Separator orientation="vertical" className="h-7!" />

              <Toggle
                variant="outline"
                size="sm"
                pressed={showPendingAiDiffs}
                onPressedChange={onTogglePendingAiDiffs}
                disabled={isAiEditInProgress}

              >
                <Diff className="h-2 w-2" />
              </Toggle>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 px-1 bg-green-500 hover:bg-green-400 text-white text-xs flex items-center gap-1"
                onClick={onAcceptAiEdit}
                disabled={isAiEditInProgress}
              >
                <Check className="h-2 w-2" /> Accept all
              </Button>
              <Button
                size="sm"
                className="h-7 px-1 bg-red-500 hover:bg-red-400 text-white text-xs flex items-center gap-1"
                onClick={onRejectAiEdit}
                disabled={isAiEditInProgress}
              >
                <X className="h-2 w-2" /> Reject all
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div
        className={`relative p-[2px] rounded-md bg-linear-to-r from-green-400 to-purple-600 ${isCentered ? "shadow-centered-action-bar" : "shadow-lg"} max-w-[470px] mx-auto transition-shadow duration-300 ease-in-out`}
      >
        <div className="bg-background rounded-md p-1 flex">
          {isAiEnabled ? (
            <DropdownMenu
              onOpenChange={(open) => {
                // Close command list when mode list is opened
                if (open) {
                  setShowCompletionList(false);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center px-2 hover:bg-muted rounded">
                  {getModeIcon()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="mb-1">
                {isVoiceActive ? (
                  <>
                    <DropdownMenuItem
                      onClick={muteMicrophone}
                      disabled={!isAiEnabled}
                    >
                      {isMicMuted ? (
                        <>
                          <MicOff className="h-4 w-4 mr-2" /> Unmute microphone
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-2" /> Mute microphone
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        endConversation();
                        setCurrentMode("ask");
                      }}
                      disabled={!isAiEnabled}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" /> End
                      conversation
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {(hasSelectedGist
                      ? ([
                        [Lightbulb, "Auto"],
                        [Mic, "Talk", startVoiceConversation],
                        [],
                        [MessageCircleQuestion, "Ask"],
                        [Pencil, "Edit"],
                        [], // Seperator
                        [ClipboardList, "discuss", null, "Review"],
                        [Telescope, "Research"],
                      ] as [
                        React.ElementType,
                        string,
                        (() => void)?,
                        string?,
                      ][])
                      : ([
                        [Lightbulb, "Auto"],
                        [],
                        [MessageCircleQuestion, "Ask"],
                        [Telescope, "Research"],
                      ] as [
                        React.ElementType,
                        string,
                        (() => void)?,
                        string?,
                      ][])
                    ).map(([Icon, mode, onClick, label], index) =>
                      Icon ? (
                        <DropdownMenuItem
                          key={index}
                          className={
                            currentMode === mode.toLowerCase()
                              ? "bg-primary text-primary-foreground"
                              : ""
                          }
                          onClick={() => {
                            if (onClick) {
                              onClick();
                            }
                            setCurrentMode(mode.toLowerCase() as ModeType);
                            setTimeout(() => inputRef.current?.focus(), 200);
                          }}
                          disabled={!isAiEnabled}
                        >
                          <Icon className="h-4 w-4 mr-2" /> {label || mode}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuSeparator key={index} />
                      )
                    )}
                  </>
                )}
                {!isVoiceActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Settings className="h-4 w-4 mr-2" /> Configure
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {getGlobalFrontmatter && updateGlobalFrontMatter && (
                          <DropdownMenuItem
                            onClick={() =>
                              setTimeout(
                                () => setIsGlobalConfigureDialogOpen(true),
                                200
                              )
                            }
                          >
                            <Globe className="h-4 w-4 mr-2" /> Global settings
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            setTimeout(
                              () => setIsConfigureDialogOpen(true),
                              200
                            )
                          }
                        >
                          <FileText className="h-4 w-4 mr-2" /> Document
                          settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            setTimeout(() => setIsSettingsDialogOpen(true), 200)
                          }
                        >
                          <Settings2 className="h-4 w-4 mr-2" /> Model settings
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setTimeout(() => setIsAnalyzeDialogOpen(true), 200)
                          }
                          disabled={gists.length === 0}
                        >
                          <BookOpen className="h-4 w-4 mr-2" /> Analyze writing
                          style
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              className="flex items-center justify-center px-1 hover:bg-muted rounded"
              onClick={() => setIsSettingsDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
          <div className="relative flex-1">
            {showCompletionList && filterCompletionItems.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-full z-9999">
                <Command className="w-full rounded-md border shadow-md bg-popover">
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {filterCompletionItems.map((item, index) => (
                      <CommandItem
                        key={
                          completionListType === "command"
                            ? (item as Command).name
                            : index
                        }
                        onSelect={() => {
                          if (completionListType === "command") {
                            handleCommandSelect(item as Command);
                          } else if (completionListType === "gist") {
                            handleGistSelect(item as Gist);
                          } else if (completionListType === "file") {
                            handleFileSelect(item as string);
                          }
                        }}
                        onMouseEnter={() => setSelectedCompletionIndex(index)}
                        className={`flex items-start gap-2 cursor-pointer px-2 py-1.5 ${index === selectedCompletionIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent"
                          }
                        `}
                      >
                        {completionListType === "command" ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              {renderCommandName((item as Command).name)}
                              {(item as Command).isGlobal && (
                                <Globe className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {(item as Command).description}
                            </span>
                          </div>
                        ) : completionListType === "gist" ? (
                          <div className="flex items-center gap-1 overflow-hidden">
                            <span className="truncate flex-1">
                              {getGistDisplayName(item as Gist)}
                            </span>
                            <span className="text-xs text-muted-foreground pl-2 whitespace-nowrap">
                              {formatDistanceToNow((item as Gist).updated_at, {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        ) : (
                          <span>{item as string}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </div>
            )}
            <div className="relative flex-1">
              <div
                ref={highlightRef}
                className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-sm px-2 py-1 overflow-auto"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: highlightedCommandText }}
                style={{ height: textareaHeight || "28px" }}
              />
              <Textarea
                ref={inputRef}
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                rows={1} // This forces the default height to be 1 line
                placeholder={
                  isAiEnabled
                    ? currentMode === "talk"
                      ? "Ask a question or propose a change..."
                      : currentMode === "edit"
                        ? hasSelection
                          ? "How should we edit the selection?"
                          : "What change would you like to make?"
                        : currentMode === "ask"
                          ? hasSelection
                            ? "What question do you have about the selection?"
                            : "What would you like to know?"
                          : currentMode === "research"
                            ? hasSelection
                              ? "How should we research the selection?"
                              : "What would you like to research?"
                            : currentMode === "auto"
                              ? "What would you like to know or do?"
                              : hasSelection
                                ? "How should we review the selection?"
                                : "What would you like to review?"
                    : "Configure your AI settings..."
                }
                className="w-full resize-none min-h-0 flex-1 bg-transparent! border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm px-2 py-1 relative text-transparent caret-foreground"
                disabled={!isAiEnabled || isCommandInProgress}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={
              isCommandInProgress
                ? cancelCommand || (() => { })
                : isAiEnabled
                  ? handleSendText
                  : () => setIsSettingsDialogOpen(true)
            }
            disabled={
              isCommandInProgress
                ? !cancelCommand
                : isAiEnabled && !commandText.trim() && commands.length === 0
            }
            className={`rounded h-auto p-1! ${isCommandInProgress && cancelCommand
              ? "hover:text-white"
              : "hover:bg-muted"
              }`}
          >
            {isCommandInProgress ? (
              cancelCommand ? (
                <CircleStop className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <ConfigureActionBarDialog
        isOpen={isConfigureDialogOpen}
        onOpenChange={setIsConfigureDialogOpen}
        getFrontmatter={getFrontmatter}
        updateFrontmatter={updateFrontmatter}
      />

      {getGlobalFrontmatter && updateGlobalFrontMatter && (
        <ConfigureActionBarDialog
          isOpen={isGlobalConfigureDialogOpen}
          onOpenChange={setIsGlobalConfigureDialogOpen}
          getFrontmatter={getGlobalFrontmatter}
          updateFrontmatter={updateGlobalFrontMatter}
          scope="global"
        />
      )}

      <AnalyzeStyleDialog
        isOpen={isAnalyzeDialogOpen}
        onOpenChange={setIsAnalyzeDialogOpen}
        gists={gists}
      />

      <ConfigureAiDialog
        isOpen={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
        onSave={onSaveAiSettings}
      />
    </div>
  );
};
