import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { AiMode } from "../commands";
import { aiSettingsStore, OPENAI_MODELS } from "../settings";
import { ExternalLink, Info, Trash2 } from "lucide-react";
import { useState } from "react";

const MODEL_PICKERS: { mode: AiMode; label: string; tooltip: string }[] = [
  { mode: "ask", label: "Ask model", tooltip: "The AI model used to ask questions" },
  { mode: "edit", label: "Edit model", tooltip: "The AI model used to edit files and content" },
  { mode: "review", label: "Review model", tooltip: "The AI model used to review content" },
  {
    mode: "research",
    label: "Research model",
    tooltip: "The AI model used to perform research tasks",
  },
];

/** Configures the user's OpenAI API key, and the model that's used for each mode. */
export default function ModelSettingsDialog({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState(() => aiSettingsStore.state);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure AI Features</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 pt-5">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="apiKey">OpenAI API Key</Label>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            </div>
            <div className="relative">
              <Input
                id="apiKey"
                placeholder="sk-..."
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                type="password"
                className="pr-9"
              />
              {settings.apiKey && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-red-500 hover:text-red-600"
                  onClick={() => setSettings({ ...settings, apiKey: "" })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {MODEL_PICKERS.map(({ mode, label, tooltip }) => (
              <div key={mode} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={label}>{label}</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 cursor-help text-muted-foreground hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  items={OPENAI_MODELS}
                  value={settings.models[mode]}
                  onValueChange={(model) =>
                    model &&
                    setSettings({ ...settings, models: { ...settings.models, [mode]: model } })
                  }
                >
                  <SelectTrigger id={label} className="w-full">
                    <SelectValue placeholder="Select a model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Switch
              id="show-reasoning-summaries"
              checked={settings.showReasoningSummaries}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, showReasoningSummaries: checked })
              }
            />
            <label htmlFor="show-reasoning-summaries" className="text-sm cursor-pointer">
              Show reasoning summaries?
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              aiSettingsStore.setState(() => settings);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
