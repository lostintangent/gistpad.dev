import type { Command } from "@/features/commands/command";
import { MessageSquare, Mic, MicOff } from "lucide-react";
import type { TalkSession } from "./talk";

export function talkCommands(talk: TalkSession) {
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
      agent:
        "Mute or unmute the user's microphone (on means muted; only when the user explicitly asks).",
      run: talk.toggleMute,
    } satisfies Command,
    end: {
      id: "agent.talk.end",
      group: "Agent",
      title: "End conversation",
      icon: MessageSquare,
      agent: "End the voice conversation (only when the user explicitly asks to).",
      run: talk.end,
    } satisfies Command,
  };
}
