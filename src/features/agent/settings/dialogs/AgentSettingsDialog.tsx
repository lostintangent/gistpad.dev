import { usePreferences, useUpdatePreferences } from "@/features/account/queries";
import { readDraft, updateDraft } from "@/features/files/draft";
import { useActiveFile, useFileContent, useSaveFile } from "@/features/files/file";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { MessageCircleQuestion, Mic, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { DEFAULT_VOICE, VOICES } from "../../talk/talk";
import {
  parseFrontMatter,
  parseGlobalSettings,
  updateFrontMatter,
  updateGlobalSettings,
  type CommandSettings,
  type FrontMatter,
} from "../frontMatter/schema";

const VOICE_ITEMS = VOICES.map(({ name }) => ({
  value: name,
  label: `${name[0].toUpperCase()}${name.slice(1)}`,
}));

/**
 * Edits the agent's settings (for the active file, or globally) as a form, while preserving any
 * other frontmatter properties.
 */
export default function AgentSettingsDialog({
  scope,
  onClose,
}: {
  scope: "file" | "global";
  onClose: () => void;
}) {
  const file = useActiveFile();
  const content = useFileContent(file);
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const saveFile = useSaveFile(file);

  const frontMatter =
    scope === "global" ? parseGlobalSettings(preferences) : (parseFrontMatter(content) ?? {});

  const [form, setForm] = useState(() => toForm(frontMatter));
  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((form) => ({ ...form, [key]: value }));

  const save = () => {
    if (scope === "global") {
      updatePreferences((preferences) =>
        updateGlobalSettings(preferences, (settings) => toFrontMatter(settings, form)),
      );
    } else {
      // If the file didn't have unsaved changes, then save the settings right away.
      const hadChanges = !!readDraft(file);
      updateDraft(file, { content: updateFrontMatter(content, toFrontMatter(frontMatter, form)) });
      if (!hadChanges && !file.isReadOnly) saveFile();
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-5">
        <DialogHeader>
          <DialogTitle>Configure agent ({scope})</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="general">
              <NotebookPen /> General
            </TabsTrigger>
            <TabsTrigger value="review">
              <MessageCircleQuestion /> Ask / Review
            </TabsTrigger>
            <TabsTrigger value="edit">
              <Pencil /> Edit
            </TabsTrigger>
            <TabsTrigger value="talk">
              <Mic /> Talk
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="general"
            className="grid grid-cols-[80px_1fr] gap-4 mt-6 items-center"
          >
            <Label htmlFor="general-instructions" className="self-start pt-2">
              Instructions
            </Label>
            <Textarea
              id="general-instructions"
              value={form.general.instructions}
              onChange={(e) => update("general", { instructions: e.target.value })}
              placeholder="General instructions for the agent"
              rows={4}
            />
          </TabsContent>

          {(["review", "edit"] as const).map((type) => (
            <TabsContent key={type} value={type}>
              <CommandSectionFields
                id={type}
                section={form[type]}
                onChange={(section) => update(type, section)}
                placeholder={`Custom instructions for ${type} commands`}
                canOverrideGlobalSettings={scope === "file"}
              />
            </TabsContent>
          ))}

          <TabsContent value="talk" className="grid grid-cols-[80px_1fr] gap-4 mt-6 items-center">
            <Label htmlFor="voice">Voice</Label>
            <Select
              items={VOICE_ITEMS}
              value={form.talk.voice}
              onValueChange={(voice) => voice && update("talk", { ...form.talk, voice })}
            >
              <SelectTrigger id="voice" className="w-full">
                <SelectValue placeholder="Select a voice..." />
              </SelectTrigger>
              <SelectContent>
                {VOICE_ITEMS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label htmlFor="persona">Persona</Label>
            <Input
              id="persona"
              value={form.talk.persona}
              onChange={(e) => update("talk", { ...form.talk, persona: e.target.value })}
              placeholder="The voice assistant's personality"
            />

            <Label htmlFor="talk-instructions" className="self-start pt-2">
              Instructions
            </Label>
            <Textarea
              id="talk-instructions"
              value={form.talk.instructions}
              onChange={(e) => update("talk", { ...form.talk, instructions: e.target.value })}
              placeholder="Custom instructions for the voice assistant"
              rows={4}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [addedRowId, setAddedRowId] = useState<string | null>(null);
  const commandCount = section.commands.filter(({ name }) => name.trim()).length;

  const updateRow = (rowId: string, changes: Partial<CommandRow>) =>
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

// The form's state is derived from the frontmatter, and then merged back into it when it's saved.

type Form = ReturnType<typeof toForm>;
type CommandSection = ReturnType<typeof toCommandSection>;
type CommandRow = ReturnType<typeof createRow>;

function toForm({ general, review, edit, talk }: FrontMatter) {
  return {
    general: { instructions: general?.instructions ?? "" },
    review: toCommandSection(review),
    edit: toCommandSection(edit),
    talk: {
      voice: talk?.voice || DEFAULT_VOICE,
      persona: talk?.persona ?? "",
      instructions: talk?.instructions ?? "",
    },
  };
}

function toCommandSection(section: CommandSettings | undefined) {
  const commands = Object.entries(section?.commands ?? {}).map(([name, command]) =>
    typeof command === "string"
      ? createRow(name, command)
      : createRow(name, command.prompt, command.description),
  );

  return {
    commands: commands.length > 0 ? commands : [createRow()],
    instructions: section?.instructions ?? "",
    overridesGlobalSettings: !!section?.overridesGlobalSettings,
  };
}

/** A command, whose description (if it has one) is preserved when it's saved. */
function createRow(name = "", prompt = "", description?: string) {
  return { id: crypto.randomUUID(), name, prompt, description };
}

function toFrontMatter(frontMatter: FrontMatter, form: Form): FrontMatter {
  const updated: FrontMatter = {
    ...frontMatter,
    general: mergeSection(frontMatter.general, {
      instructions: form.general.instructions.trim() && form.general.instructions,
    }),
    review: mergeCommandSection(frontMatter.review, form.review),
    edit: mergeCommandSection(frontMatter.edit, form.edit),
    talk: mergeSection(frontMatter.talk, {
      voice: form.talk.voice === DEFAULT_VOICE ? undefined : form.talk.voice,
      persona: form.talk.persona.trim() && form.talk.persona,
      instructions: form.talk.instructions.trim() && form.talk.instructions,
    }),
  };

  // Omit the empty sections
  return Object.fromEntries(Object.entries(updated).filter(([, value]) => value !== undefined));
}

function mergeCommandSection(section: CommandSettings | undefined, form: CommandSection) {
  const commands = form.commands.filter(({ name }) => name.trim());

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
    instructions: form.instructions.trim() && form.instructions,
    overridesGlobalSettings: form.overridesGlobalSettings,
  });
}

/** Merges properties into a frontmatter section, omitting empty ones (and the section, if it's empty). */
function mergeSection<Section extends object>(
  section: Section | undefined,
  properties: Partial<Record<keyof Section, unknown>>,
): Section | undefined {
  const merged: Record<string, unknown> = { ...section, ...properties };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || value === false) delete merged[key];
  }
  return Object.keys(merged).length > 0 ? (merged as Section) : undefined;
}
