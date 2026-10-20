import type { Command } from "@/features/commands/command";
import { MessageSquare, Mic, MicOff } from "lucide-react";
import type { TalkConversation } from "./useTalkConversation";

export function talkCommands(talk: TalkConversation) {
  return {
    start: {
      id: "agent.talk",
      group: "Agent",
      title: "Talk",
      icon: Mic,
      disabled: talk.isConnecting,
      run: talk.start,
    } satisfies Command,
    mute: {
      id: "agent.talk.mute",
      group: "Agent",
      title: talk.isMicMuted ? "Unmute microphone" : "Mute microphone",
      icon: talk.isMicMuted ? MicOff : Mic,
      checked: talk.isMicMuted,
      run: talk.toggleMute,
    } satisfies Command,
    end: {
      id: "agent.talk.end",
      group: "Agent",
      title: "End conversation",
      icon: MessageSquare,
      run: talk.end,
    } satisfies Command,
  };
}
