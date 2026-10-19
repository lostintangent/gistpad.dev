import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Info, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { agentModelAtom, apiKeyAtom, researchModelAtom } from "../modelSettings";

/** Formats a model's ID as a display name (e.g. "gpt-6.1-sol" → "GPT-6.1 Sol"). */
function modelLabel(id: string) {
  if (!id.startsWith("gpt-")) return id;

  const [version, ...variant] = id.slice(4).split("-");
  const words = variant.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return [`GPT-${version}`, ...words].join(" ");
}

/** Picks a model, from the ones that the user's API key can use. */
function ModelPicker({
  label,
  tooltip,
  model,
  availableModels,
  onChange,
}: {
  label: string;
  tooltip: string;
  model: string;
  availableModels: string[];
  onChange: (model: string) => void;
}) {
  const id = useId();

  // Include the current model, in case the list hasn't loaded (or doesn't include it)
  const items = (
    availableModels.includes(model) ? availableModels : [model, ...availableModels]
  ).map((id) => ({ value: id, label: modelLabel(id) }));

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-4 w-4 cursor-help text-muted-foreground hover:text-foreground transition-colors" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Select items={items} value={model} onValueChange={(value) => value && onChange(value)}>
        <SelectTrigger id={id} className="w-full">
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
}

/** Configures the user's OpenAI API key, and the models that the agent and research use. */
export default function ModelSettingsDialog({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState(() => apiKeyAtom.get());
  const [agentModel, setAgentModel] = useState(() => agentModelAtom.get());
  const [researchModel, setResearchModel] = useState(() => researchModelAtom.get());

  // Wait until the user stops typing their API key, before loading its models
  const [modelsApiKey, setModelsApiKey] = useState(apiKey);
  useEffect(() => {
    const timeout = setTimeout(() => setModelsApiKey(apiKey), 500);
    return () => clearTimeout(timeout);
  }, [apiKey]);

  const { data: availableModels = [], isError } = useQuery({
    queryKey: ["openai-models", modelsApiKey],
    queryFn: async ({ signal }) => {
      const { listModels } = await import("../../openai");
      return listModels(modelsApiKey, signal);
    },
    enabled: !!modelsApiKey,
    staleTime: 1000 * 60 * 60,
    retry: false,
    // Since it's keyed by the API key, don't copy it into the query cache's localStorage
    meta: { persist: false },
  });

  const save = () => {
    apiKeyAtom.set(apiKey);
    agentModelAtom.set(agentModel);
    researchModelAtom.set(researchModel);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure models</DialogTitle>
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
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                className="pr-9"
              />
              {apiKey && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-red-500 hover:text-red-600"
                  onClick={() => setApiKey("")}
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
            <ModelPicker
              label="Agent model"
              tooltip="The model that the agent uses to answer questions, and edit and review files"
              model={agentModel}
              availableModels={availableModels}
              onChange={setAgentModel}
            />
            <ModelPicker
              label="Research model"
              tooltip="The model that the agent uses to perform research tasks, and analyze writing styles"
              model={researchModel}
              availableModels={availableModels}
              onChange={setResearchModel}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
