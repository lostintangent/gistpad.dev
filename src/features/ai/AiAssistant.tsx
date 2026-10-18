import type { ActiveFile } from "@/features/files/file";
import { ActionBar } from "./ActionBar";
import { useAiCommands } from "./useAiCommands";
import { useVoiceConversation } from "./voice/useVoiceConversation";

/**
 * The AI assistant for the active file: its action bar, and voice conversations (which continue
 * while the action bar is hidden, e.g. while the comments are open on mobile). It's only loaded
 * when the user has configured AI.
 */
export default function AiAssistant({
  file,
  showActionBar,
}: {
  file: ActiveFile;
  showActionBar: boolean;
}) {
  const ai = useAiCommands();
  const voice = useVoiceConversation(file, ai);

  return showActionBar && <ActionBar ai={ai} voice={voice} />;
}
