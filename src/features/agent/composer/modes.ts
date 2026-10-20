import {
  ClipboardList,
  Lightbulb,
  MessageCircleQuestion,
  Mic,
  Pencil,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import type { ComposerMode } from "../model/modes";

/** Agent UI metadata is shared by its producers, not owned by a particular menu. */
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

export function composerModes(hasFile: boolean): readonly (ComposerMode | null)[] {
  return hasFile
    ? ["auto", "talk", null, "ask", "edit", null, "review", "research"]
    : ["auto", null, "ask", "research"];
}
