import type { Command } from "@/features/commands/command";
import { useCommands } from "@/features/commands/registry";
import { Dialog } from "@/shared/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Settings2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const modelSettingsDialog = DialogPrimitive.createHandle();
const ModelSettingsDialog = lazy(() => import("./dialogs/ModelSettingsDialog"));

export const modelSettingsCommand: Command = {
  id: "agent.settings.model-settings",
  title: "AI settings",
  group: "Settings",
  icon: Settings2,
  run: () => modelSettingsDialog.open(null),
};

/** Keeps model setup available before the agent is configured, without loading its UI. */
export default function ModelSettings() {
  const [isOpen, setIsOpen] = useState(false);
  useCommands([modelSettingsCommand]);

  return (
    <Dialog handle={modelSettingsDialog} onOpenChange={setIsOpen}>
      {isOpen && (
        <Suspense>
          <ModelSettingsDialog onClose={() => modelSettingsDialog.close()} />
        </Suspense>
      )}
    </Dialog>
  );
}
