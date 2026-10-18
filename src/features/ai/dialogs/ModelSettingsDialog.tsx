import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import type { AiMode } from "../commands";
import { aiSettingsStore } from "../settings";
import { ExternalLink, Info, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

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

/** Formats a model's ID as a display name (e.g. "gpt-6.1-sol" → "GPT-6.1 Sol"). */
function modelLabel(id: string) {
  if (!id.startsWith("gpt-")) return id;

  const [version, ...variant] = id.slice(4).split("-");
  const words = variant.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return [`GPT-${version}`, ...words].join(" ");
}

/** Configures the user's OpenAI API key, and the model that's used for each mode. */
export default function ModelSettingsDialog({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState(() => aiSettingsStore.state);

  // Wait until the user stops typing their API key, before loading its models
  const [modelsApiKey, setModelsApiKey] = useState(settings.apiKey);
  useEffect(() => {
    const timeout = setTimeout(() => setModelsApiKey(settings.apiKey), 500);
    return () => clearTimeout(timeout);
  }, [settings.apiKey]);

  const { data: availableModels = [], isError } = useQuery({
    queryKey: ["openai-models", modelsApiKey],
    queryFn: async ({ signal }) => {
      const { listModels } = await import("../agents");
      return listModels(modelsApiKey, signal);
    },
    enabled: !!modelsApiKey,
    staleTime: 1000 * 60 * 60,
    retry: false,
    // Since it's keyed by the API key, don't copy it into the query cache's localStorage
    meta: { persist: false },
  });

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
            {isError && (
              <p className="text-xs text-red-500">
                Couldn't load the available models. Make sure your API key is valid.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {MODEL_PICKERS.map(({ mode, label, tooltip }) => {
              // Include the current model, in case the list hasn't loaded (or doesn't include it)
              const model = settings.models[mode];
              const items = (
                availableModels.includes(model) ? availableModels : [model, ...availableModels]
              ).map((id) => ({ value: id, label: modelLabel(id) }));

              return (
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
                    items={items}
                    value={model}
                    onValueChange={(value) =>
                      value &&
                      setSettings({ ...settings, models: { ...settings.models, [mode]: value } })
                    }
                  >
                    <SelectTrigger id={label} className="w-full">
                      <SelectValue placeholder="Select a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
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
