import { getModelSetting, OPENAI_MODELS } from "@/agents/openai";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLink, Info, Trash2 } from "lucide-react";
import { useState } from "react";

interface ModelPickerProps {
  label: string;
  tooltip: string;
  model: string;
  onModelChange: (value: string) => void;
}

const ModelPicker = ({
  label,
  tooltip,
  model,
  onModelChange,
}: ModelPickerProps) => {
  return (
    <div className="grid gap-2">
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
      <Select value={model} onValueChange={onModelChange}>
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
  );
};

interface ConfigureAiDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    apiKey: string,
    askModel: string,
    editModel: string,
    reviewModel: string,
    researchModel: string,
    showReasoningSummaries: boolean
  ) => void;
}

const ConfigureAiDialog = ({
  isOpen,
  onOpenChange,
  onSave,
}: ConfigureAiDialogProps) => {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("gistpad-openai-key") || ""
  );

  const [askModel, setAskModel] = useState(getModelSetting("ask"));
  const [editModel, setEditModel] = useState(getModelSetting("edit"));
  const [reviewModel, setReviewModel] = useState(getModelSetting("review"));
  const [researchModel, setResearchModel] = useState(getModelSetting("research"));

  const [showReasoningSummaries, setShowReasoningSummaries] = useState(
    localStorage.getItem("gistpad-show-reasoning-summaries") !== "false"
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure AI Features</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 pt-5">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="apiKey">OpenAI API Key</Label>
              <ExternalLink
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                onClick={() =>
                  window.open("https://platform.openai.com/api-keys", "_blank")
                }
              />
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
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <ModelPicker
              label="Ask model"
              model={askModel}
              onModelChange={setAskModel}
              tooltip="The AI model used to ask questions"
            />
            <ModelPicker
              label="Edit model"
              model={editModel}
              onModelChange={setEditModel}
              tooltip="The AI model used to edit files and content"
            />
            <ModelPicker
              label="Review model"
              model={reviewModel}
              onModelChange={setReviewModel}
              tooltip="The AI model used to review content"
            />
            <ModelPicker
              label="Research model"
              model={researchModel}
              onModelChange={setResearchModel}
              tooltip="The AI model used to perform research tasks"
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Switch
              id="show-reasoning-summaries"
              checked={showReasoningSummaries}
              onCheckedChange={(c) => setShowReasoningSummaries(!!c)}
            />
            <label
              htmlFor="show-reasoning-summaries"
              className="text-sm cursor-pointer"
            >
              Show reasoning summaries?
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              onSave(
                apiKey,
                askModel,
                editModel,
                reviewModel,
                researchModel,
                showReasoningSummaries
              );
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfigureAiDialog;
