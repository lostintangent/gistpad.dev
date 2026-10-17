import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { MessageCircleQuestion, Mic, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import type { FrontMatter } from "@/shared/frontMatter";
import { useState } from "react";

// The action bar is configured via frontmatter (in a document, or the user's global settings),
// which this dialog edits as a form, while preserving any other frontmatter properties.

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"].map(
  (voice) => ({ value: voice, label: `${voice[0].toUpperCase()}${voice.slice(1)}` }),
);
const DEFAULT_VOICE = "alloy";

const asString = (value: unknown) => (typeof value === "string" ? value : "");

let nextRowId = 0;
// Commands can also be an object with a description, which is preserved when they're saved.
const createRow = (name = "", prompt = "", description?: string) => ({
  id: nextRowId++,
  name,
  prompt,
  description,
});

type CommandRow = ReturnType<typeof createRow>;
type CommandSection = ReturnType<typeof toCommandSection>;
type Settings = ReturnType<typeof toSettings>;

function toCommandSection(section: FrontMatter | undefined) {
  const commands = Object.entries<string | FrontMatter>(section?.commands ?? {}).map(
    ([name, value]) =>
      typeof value === "string"
        ? createRow(name, value)
        : createRow(name, asString(value?.prompt), asString(value?.description) || undefined),
  );

  return {
    commands: commands.length > 0 ? commands : [createRow()],
    instructions: asString(section?.instructions),
    overridesGlobalSettings: section?.overridesGlobalSettings === true,
  };
}

function toSettings(frontMatter: FrontMatter) {
  return {
    general: { instructions: asString(frontMatter.general?.instructions) },
    discuss: toCommandSection(frontMatter.discuss),
    edit: toCommandSection(frontMatter.edit),
    talk: {
      voice: asString(frontMatter.talk?.voice) || DEFAULT_VOICE,
      persona: asString(frontMatter.talk?.persona),
      instructions: asString(frontMatter.talk?.instructions),
    },
  };
}

/** Merges properties into a frontmatter section, omitting empty ones (and the section, if it's empty). */
function mergeSection(section: FrontMatter | undefined, properties: FrontMatter) {
  const merged = { ...section, ...properties };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || value === false) delete merged[key];
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeCommandSection(section: FrontMatter | undefined, settings: CommandSection) {
  const commands = settings.commands.filter(({ name }) => name.trim());

  return mergeSection(section, {
    commands:
      commands.length > 0
        ? Object.fromEntries(
            commands.map(({ name, prompt, description }) => [
              name.trim(),
              description ? { prompt, description } : prompt,
            ]),
          )
        : undefined,
    instructions: settings.instructions.trim() && settings.instructions,
    overridesGlobalSettings: settings.overridesGlobalSettings,
  });
}

function toFrontMatter(frontMatter: FrontMatter, settings: Settings): FrontMatter {
  const updated: FrontMatter = {
    ...frontMatter,
    general: mergeSection(frontMatter.general, {
      instructions: settings.general.instructions.trim() && settings.general.instructions,
    }),
    discuss: mergeCommandSection(frontMatter.discuss, settings.discuss),
    edit: mergeCommandSection(frontMatter.edit, settings.edit),
    talk: mergeSection(frontMatter.talk, {
      voice: settings.talk.voice === DEFAULT_VOICE ? undefined : settings.talk.voice,
      persona: settings.talk.persona.trim() && settings.talk.persona,
      instructions: settings.talk.instructions.trim() && settings.talk.instructions,
    }),
  };

  return Object.fromEntries(Object.entries(updated).filter(([, value]) => value !== undefined));
}

function CommandSectionFields({
  id,
  section,
  onChange,
  placeholder,
  canOverrideGlobalSettings,
}: {
  id: string;
  section: CommandSection;
  onChange: (section: CommandSection) => void;
  placeholder: string;
  canOverrideGlobalSettings: boolean;
}) {
  const [addedRowId, setAddedRowId] = useState<number | null>(null);
  const commandCount = section.commands.filter(({ name }) => name.trim()).length;

  const updateRow = (rowId: number, changes: Partial<CommandRow>) =>
    onChange({
      ...section,
      commands: section.commands.map((row) => (row.id === rowId ? { ...row, ...changes } : row)),
    });

  return (
    <div className="flex flex-col gap-4 mt-6">
      <Label>Custom slash commands{commandCount > 0 && ` (${commandCount})`}</Label>

      <div className="overflow-y-auto max-h-[150px] space-y-3 p-1">
        {section.commands.map((row) => (
          <div key={row.id} className="flex gap-2">
            <Input
              value={row.name}
              onChange={(e) => updateRow(row.id, { name: e.target.value })}
              placeholder="Name"
              className="w-[90px]"
              // Focus (and scroll to) newly added commands
              autoFocus={row.id === addedRowId}
            />
            <Textarea
              value={row.prompt}
              onChange={(e) => updateRow(row.id, { prompt: e.target.value })}
              placeholder="Prompt"
              className="min-h-[60px]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-600"
              onClick={() =>
                onChange({
                  ...section,
                  commands: section.commands.filter(({ id }) => id !== row.id),
                })
              }
              aria-label="Delete command"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="accent"
        size="sm"
        onClick={() => {
          const row = createRow();
          setAddedRowId(row.id);
          onChange({ ...section, commands: [...section.commands, row] });
        }}
      >
        <Plus /> Add command
      </Button>

      <div className="flex gap-4 pt-4">
        <Label htmlFor={`${id}-instructions`}>Instructions</Label>
        <Textarea
          id={`${id}-instructions`}
          value={section.instructions}
          onChange={(e) => onChange({ ...section, instructions: e.target.value })}
          placeholder={placeholder}
          rows={2}
        />
      </div>

      {canOverrideGlobalSettings && (
        <Label className="text-sm pt-2">
          <Checkbox
            checked={section.overridesGlobalSettings}
            onCheckedChange={(checked) =>
              onChange({ ...section, overridesGlobalSettings: checked })
            }
          />
          Overrides global settings?
        </Label>
      )}
    </div>
  );
}

function SettingsForm({
  scope,
  frontMatter,
  onSave,
}: {
  scope: "document" | "global";
  frontMatter: FrontMatter;
  onSave: (frontMatter: FrontMatter) => void;
}) {
  const [settings, setSettings] = useState(() => toSettings(frontMatter));
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((settings) => ({ ...settings, [key]: value }));

  return (
    <>
      <Tabs defaultValue="general" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="general">
            <NotebookPen /> General
          </TabsTrigger>
          <TabsTrigger value="discuss">
            <MessageCircleQuestion /> Ask / Review
          </TabsTrigger>
          <TabsTrigger value="edit">
            <Pencil /> Edit
          </TabsTrigger>
          <TabsTrigger value="talk">
            <Mic /> Talk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="grid grid-cols-[80px_1fr] gap-4 mt-6 items-center">
          <Label htmlFor="general-instructions" className="self-start pt-2">
            Instructions
          </Label>
          <Textarea
            id="general-instructions"
            value={settings.general.instructions}
            onChange={(e) => update("general", { instructions: e.target.value })}
            placeholder="General instructions for AI"
            rows={4}
          />
        </TabsContent>

        {(["discuss", "edit"] as const).map((type) => (
          <TabsContent key={type} value={type}>
            <CommandSectionFields
              id={type}
              section={settings[type]}
              onChange={(section) => update(type, section)}
              placeholder={`Custom instructions for ${type === "edit" ? "edit" : "review"} commands`}
              canOverrideGlobalSettings={scope === "document"}
            />
          </TabsContent>
        ))}

        <TabsContent value="talk" className="grid grid-cols-[80px_1fr] gap-4 mt-6 items-center">
          <Label htmlFor="voice">Voice</Label>
          <Select
            items={VOICES}
            value={settings.talk.voice}
            onValueChange={(voice) => voice && update("talk", { ...settings.talk, voice })}
          >
            <SelectTrigger id="voice" className="w-full">
              <SelectValue placeholder="Select a voice..." />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label htmlFor="persona">Persona</Label>
          <Input
            id="persona"
            value={settings.talk.persona}
            onChange={(e) => update("talk", { ...settings.talk, persona: e.target.value })}
            placeholder="The voice assistant's personality"
          />

          <Label htmlFor="talk-instructions" className="self-start pt-2">
            Instructions
          </Label>
          <Textarea
            id="talk-instructions"
            value={settings.talk.instructions}
            onChange={(e) => update("talk", { ...settings.talk, instructions: e.target.value })}
            placeholder="Custom instructions for the voice assistant"
            rows={4}
          />
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button onClick={() => onSave(toFrontMatter(frontMatter, settings))}>Save</Button>
      </DialogFooter>
    </>
  );
}

/** Configures the action bar's instructions and custom commands (for a document, or globally). */
export default function ActionBarSettingsDialog({
  isOpen,
  onOpenChange,
  scope,
  frontMatter,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "document" | "global";
  frontMatter: FrontMatter;
  onSave: (frontMatter: FrontMatter) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-5">
        <DialogHeader>
          <DialogTitle>Configure action bar ({scope})</DialogTitle>
        </DialogHeader>
        <SettingsForm
          scope={scope}
          frontMatter={frontMatter}
          onSave={(frontMatter) => {
            onSave(frontMatter);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
