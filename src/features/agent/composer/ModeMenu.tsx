import { useGists } from "@/features/gists/queries";
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
import { cn } from "cn";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Globe,
  Lightbulb,
  MessageCircleQuestion,
  MessageSquare,
  Mic,
  MicOff,
  Pencil,
  Settings,
  Settings2,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import type { ComposerMode } from "../model/modes";
import AgentSettingsDialog from "../settings/dialogs/AgentSettingsDialog";
import AnalyzeStyleDialog from "../settings/dialogs/AnalyzeStyleDialog";
import ModelSettingsDialog from "../settings/dialogs/ModelSettingsDialog";
import type { VoiceConversation } from "../voice/useVoiceConversation";

// Each mode's icon, label and command input placeholder (and when there's a selection, if it differs).
export const MODES: Record<
  ComposerMode,
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

// The modes that are available when a file is open (or not), where `null` is a separator.
const FILE_MODES = ["auto", "talk", null, "ask", "edit", null, "review", "research"] as const;
const GLOBAL_MODES = ["auto", null, "ask", "research"] as const;

type Dialog = "file-settings" | "global-settings" | "model-settings" | "analyze-style";

/**
 * Selects the composer's mode (or controls the voice conversation, while there is one),
 * and opens the agent's settings.
 */
export function ModeMenu({
  mode,
  onSelectMode,
  voice,
  hasFile,
  inputRef,
}: {
  mode: ComposerMode;
  onSelectMode: (mode: ComposerMode) => void;
  voice: VoiceConversation;
  hasFile: boolean;
  /** The command input, which takes focus after a mode is selected. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const { gists } = useGists();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // Where focus moves once the menu closes: the command input (after selecting a mode),
  // nowhere (after opening a dialog, which takes focus), or else back to the menu's trigger.
  const finalFocus = useRef<HTMLElement | boolean>(true);

  const openDialog = (name: Dialog) => {
    finalFocus.current = false;
    setDialog(name);
  };

  const closeDialog = () => setDialog(null);

  const ModeIcon = voice.isActive && voice.isMicMuted ? MicOff : MODES[mode].icon;

  return (
    <>
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
            const target = finalFocus.current;
            finalFocus.current = true;
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
              {(hasFile ? FILE_MODES : GLOBAL_MODES).map((item, index) => {
                if (!item) return <DropdownMenuSeparator key={index} />;

                const { icon: Icon, label } = MODES[item];
                return (
                  <DropdownMenuItem
                    key={item}
                    className={item === mode ? "bg-primary text-primary-foreground" : ""}
                    onClick={() => {
                      finalFocus.current = inputRef.current ?? true;
                      if (item === "talk") voice.start();
                      else onSelectMode(item);
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
                  {hasFile && (
                    <DropdownMenuItem onClick={() => openDialog("file-settings")}>
                      <FileText /> File settings
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

      {dialog === "global-settings" && <AgentSettingsDialog scope="global" onClose={closeDialog} />}
      {dialog === "file-settings" && <AgentSettingsDialog scope="file" onClose={closeDialog} />}
      {dialog === "model-settings" && <ModelSettingsDialog onClose={closeDialog} />}
      {dialog === "analyze-style" && <AnalyzeStyleDialog gists={gists} onClose={closeDialog} />}
    </>
  );
}
