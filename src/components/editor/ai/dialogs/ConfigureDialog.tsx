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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
    MessageCircleQuestion, Mic,
    NotebookPen,
    Pencil,
    Plus,
    Trash2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CommandSettings {
    commands?: Record<string, string>;
    instructions?: string;
    overridesGlobalSettings?: boolean;
}

type CommandType = "edit" | "discuss";

interface TalkSettings {
    voice?: string;
    persona?: string;
    instructions?: string;
}

interface GeneralSettings {
    instructions?: string;
}

interface ConfigureActionBarDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    getFrontmatter: () => Record<string, any> | null;
    updateFrontmatter: (newFrontmatter: Record<string, any>) => void;
    scope?: "document" | "global";
}

function defaultCommandSettings(): CommandSettings {
    return {
        commands: {
            "": "",
        },
        instructions: "",
        overridesGlobalSettings: false,
    };
}

const ConfigureActionBarDialog = ({
    isOpen,
    onOpenChange,
    getFrontmatter,
    updateFrontmatter,
    scope = "document",
}: ConfigureActionBarDialogProps) => {
    const [activeTab, setActiveTab] = useState("general");

    const [editSettings, setEditSettings] = useState<CommandSettings>(
        defaultCommandSettings()
    );
    const [discussSettings, setDiscussSettings] = useState<CommandSettings>(
        defaultCommandSettings()
    );
    const [talkSettings, setTalkSettings] = useState<TalkSettings>({});
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({});

    const newCommandNameRef = useRef<HTMLInputElement>(null);

    // TODO: Add description for each voice
    const voiceOptions = [
        { value: "alloy", label: "Alloy" },
        { value: "ash", label: "Ash" },
        { value: "ballad", label: "Ballad" },
        { value: "coral", label: "Coral" },
        { value: "echo", label: "Echo" },
        { value: "sage", label: "Sage" },
        { value: "shimmer", label: "Shimmer" },
        { value: "verse", label: "Verse" },
    ];

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        } else {
            setActiveTab("general");
        }
    }, [isOpen]);

    const loadCommandSection = (
        frontMatter: Record<string, any>,
        commandType: CommandType
    ) => {
        const section = frontMatter[commandType];
        const commands: Record<string, string> = {};

        if (section?.commands && typeof section.commands === "object") {
            Object.entries(section.commands).forEach(([key, value]) => {
                commands[key] = typeof value === "string" ? value : "";
            });
        }

        // Ensure there's at least one empty command
        if (Object.keys(commands).length === 0) {
            commands[""] = "";
        }

        const setter =
            commandType === "edit" ? setEditSettings : setDiscussSettings;
        setter({
            instructions:
                typeof section?.instructions === "string" ? section.instructions : "",
            commands,
            overridesGlobalSettings: section?.overridesGlobalSettings === true,
        });
    };

    const loadSettings = () => {
        const frontMatter = getFrontmatter();
        if (!frontMatter) {
            setEditSettings(defaultCommandSettings());
            setDiscussSettings(defaultCommandSettings());
            setTalkSettings({});
            setGeneralSettings({});
            return;
        }

        loadCommandSection(frontMatter, "edit");
        loadCommandSection(frontMatter, "discuss");

        const talkSection = frontMatter.talk || {};
        setTalkSettings({
            persona:
                typeof talkSection.persona === "string" ? talkSection.persona : "",
            instructions:
                typeof talkSection.instructions === "string"
                    ? talkSection.instructions
                    : "",
            voice:
                typeof talkSection.voice === "string" ? talkSection.voice : "alloy",
        });

        const generalSection = frontMatter.general || {};
        setGeneralSettings({
            instructions:
                typeof generalSection.instructions === "string"
                    ? generalSection.instructions
                    : "",
        });
    };

    const useCommandSetting = useCallback(
        (
            commandType: CommandType
        ): [CommandSettings, (newSettings: CommandSettings) => void] => {
            const settings = commandType === "edit" ? editSettings : discussSettings;
            const setSettings =
                commandType === "edit" ? setEditSettings : setDiscussSettings;
            return [settings, setSettings];
        },
        [editSettings, discussSettings]
    );

    const handleAddCommand = useCallback(
        (commandType: CommandType) => {
            const [settings, setSettings] = useCommandSetting(commandType);

            const newCommands = { ...settings.commands, "": "" };
            setSettings({
                ...settings,
                commands: newCommands,
            });
        },
        [useCommandSetting]
    );

    useEffect(
        () =>
            void setTimeout(() => {
                if (!newCommandNameRef.current) return;

                newCommandNameRef.current.parentElement.parentElement.scrollTo({
                    top: newCommandNameRef.current.parentElement.parentElement
                        .scrollHeight,
                    behavior: "smooth",
                });

                newCommandNameRef.current.focus();
            }, 200),
        [newCommandNameRef.current, activeTab]
    );

    const handleDeleteCommand = useCallback(
        (commandType: CommandType, commandName: string) => {
            const [settings, setSettings] = useCommandSetting(commandType);
            const newCommands = { ...settings.commands };
            delete newCommands[commandName];

            // If we deleted all commands, add an empty entry
            if (Object.keys(newCommands).length === 0) {
                newCommands[""] = "";
            }

            setSettings({
                ...settings,
                commands: newCommands,
            });
        },
        [useCommandSetting]
    );

    const handleCommandNameChange = useCallback(
        (commandType: CommandType, oldName: string, newName: string) => {
            const [settings, setSettings] = useCommandSetting(commandType);
            const newCommands = { ...settings.commands };
            const value = newCommands[oldName] || "";

            delete newCommands[oldName];
            newCommands[newName] = value;

            setSettings({
                ...settings,
                commands: newCommands,
            });
        },
        [useCommandSetting]
    );

    const handleCommandDescriptionChange = useCallback(
        (commandType: CommandType, name: string, value: string) => {
            const [settings, setSettings] = useCommandSetting(commandType);
            const newCommands = { ...settings.commands };
            newCommands[name] = value;

            setSettings({
                ...settings,
                commands: newCommands,
            });
        },
        [useCommandSetting]
    );

    const handleCommandSettingChange = useCallback(
        (
            commandType: CommandType,
            field: keyof CommandSettings,
            value: string | boolean
        ) => {
            const [settings, setSettings] = useCommandSetting(commandType);
            setSettings({
                ...settings,
                [field]: value,
            });
        },
        [useCommandSetting]
    );

    const handleTalkSettingChange = (
        field: keyof TalkSettings,
        value: string
    ) => {
        setTalkSettings({
            ...talkSettings,
            [field]: value,
        });
    };

    const handleSave = useCallback(() => {
        const frontMatter = getFrontmatter() || {};

        // Create nested structure if not exists
        if (!frontMatter.edit) frontMatter.edit = {};
        if (!frontMatter.discuss) frontMatter.discuss = {};
        if (!frontMatter.talk) frontMatter.talk = {};

        // Update commands in object format under edit.commands
        const commandsObj: Record<string, string> = {};

        Object.entries(editSettings.commands).forEach(([key, value]) => {
            if (key.trim() !== "") {
                commandsObj[key] = value || "";
            }
        });

        if (Object.keys(commandsObj).length > 0) {
            frontMatter.edit.commands = commandsObj;
        } else {
            // Remove commands if there are none
            delete frontMatter.edit.commands;
        }

        // Update edit instructions
        if (editSettings?.instructions.trim() !== "") {
            frontMatter.edit.instructions = editSettings.instructions;
        } else {
            delete frontMatter.edit.instructions;
        }

        if (editSettings.overridesGlobalSettings === true) {
            frontMatter.edit.overridesGlobalSettings = true;
        } else {
            delete frontMatter.edit.overridesGlobalSettings;
        }

        // If edit section is empty, remove it
        if (Object.keys(frontMatter.edit).length === 0) {
            delete frontMatter.edit;
        }

        // Update discussion commands under discuss.topics
        const topicsObj: Record<string, string> = {};
        Object.entries(discussSettings.commands).forEach(([key, value]) => {
            if (key.trim() !== "") {
                topicsObj[key] = value || "";
            }
        });

        if (Object.keys(topicsObj).length > 0) {
            frontMatter.discuss.commands = topicsObj;
        } else {
            // Remove discussion_commands if there are none
            delete frontMatter.discuss.commands;
        }

        // Update discuss instructions
        if (discussSettings.instructions.trim() !== "") {
            frontMatter.discuss.instructions = discussSettings.instructions;
        } else {
            delete frontMatter.discuss.instructions;
        }

        if (discussSettings.overridesGlobalSettings === true) {
            frontMatter.discuss.overridesGlobalSettings = true;
        } else {
            delete frontMatter.discuss.overridesGlobalSettings;
        }

        // If discuss section is empty, remove it
        if (Object.keys(frontMatter.discuss).length === 0) {
            delete frontMatter.discuss;
        }

        // Update talk settings
        if (talkSettings.persona?.trim()) {
            frontMatter.talk.persona = talkSettings.persona;
        } else {
            delete frontMatter.talk.persona;
        }

        if (talkSettings.instructions?.trim()) {
            frontMatter.talk.instructions = talkSettings.instructions;
        } else {
            delete frontMatter.talk.instructions;
        }

        if (talkSettings.voice && talkSettings.voice !== "alloy") {
            frontMatter.talk.voice = talkSettings.voice;
        } else {
            delete frontMatter.talk.voice;
        }

        // If talk section is empty, remove it
        if (Object.keys(frontMatter.talk).length === 0) {
            delete frontMatter.talk;
        }

        if (!frontMatter.general) frontMatter.general = {};
        if (generalSettings.instructions && generalSettings.instructions.trim()) {
            frontMatter.general.instructions = generalSettings.instructions;
        } else {
            delete frontMatter.general.instructions;
        }
        if (Object.keys(frontMatter.general).length === 0) {
            delete frontMatter.general;
        }

        updateFrontmatter(frontMatter);
        onOpenChange(false);
    }, [editSettings, discussSettings, talkSettings, generalSettings, updateFrontmatter]);

    const editCommandCount = Object.keys(editSettings.commands || {}).filter(
        (name) => name.trim() !== ""
    ).length;
    const discussCommandCount = Object.keys(
        discussSettings.commands || {}
    ).filter((name) => name.trim() !== "").length;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange} modal>
            <DialogContent className="p-5">
                <DialogHeader>
                    <DialogTitle>Configure action bar ({scope})</DialogTitle>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className="flex justify-between">
                        <TabsTrigger value="general">
                            <NotebookPen className="h-4 w-4 mr-2" /> General
                        </TabsTrigger>
                        <TabsTrigger value="discuss">
                            <MessageCircleQuestion className="h-4 w-4 mr-2" /> Ask / Review
                        </TabsTrigger>
                        <TabsTrigger value="edit">
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                        </TabsTrigger>
                        <TabsTrigger value="talk">
                            <Mic className="h-4 w-4 mr-2" /> Talk
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
                        value="general"
                        className="data-[state=active]:grid grid-cols-[80px_1fr] gap-4 data-[state=active]:mt-6 items-center"
                    >
                        <Label htmlFor="general-instructions" className="self-start pt-2">
                            Instructions
                        </Label>
                        <Textarea
                            id="general-instructions"
                            value={generalSettings.instructions || ""}
                            onChange={(e) =>
                                setGeneralSettings({ instructions: e.target.value })
                            }
                            placeholder="General instructions for AI"
                            rows={4}
                        />
                    </TabsContent>

                    <TabsContent
                        value="discuss"
                        className="data-[state=active]:mt-6 data-[state=active]:flex flex-col data-[state=active]:space-y-4"
                    >
                        <Label>
                            Custom slash commands
                            {discussCommandCount > 0 && ` (${discussCommandCount})`}
                        </Label>

                        <div className="overflow-y-auto max-h-[150px] space-y-3 p-1">
                            {Object.entries(discussSettings.commands || {}).map(
                                ([name, description], index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            value={name}
                                            onChange={(e) =>
                                                handleCommandNameChange("discuss", name, e.target.value)
                                            }
                                            placeholder="Name"
                                            className="w-[90px]"
                                            ref={
                                                name === "" && description === ""
                                                    ? newCommandNameRef
                                                    : null
                                            }
                                        />
                                        <Textarea
                                            value={description}
                                            onChange={(e) =>
                                                handleCommandDescriptionChange(
                                                    "discuss",
                                                    name,
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Description"
                                            className="min-h-[60px]"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600"
                                            onClick={() => handleDeleteCommand("discuss", name)}
                                            disabled={
                                                Object.keys(discussSettings.commands).length === 1 &&
                                                (name === "" || description === "")
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            )}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-green-700 hover:bg-green-800"
                            onClick={() => handleAddCommand("discuss")}
                        >
                            <Plus /> Add command
                        </Button>

                        <div className="flex gap-4 pt-4">
                            <Label htmlFor="discuss-instructions">Instructions</Label>
                            <Textarea
                                id="discuss-instructions"
                                value={discussSettings.instructions}
                                onChange={(e) =>
                                    handleCommandSettingChange(
                                        "discuss",
                                        "instructions",
                                        e.target.value
                                    )
                                }
                                placeholder="Custom instructions for review commands"
                                rows={2}
                            />
                        </div>

                        {scope === "document" && (
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="discuss-exclude-global"
                                    checked={discussSettings.overridesGlobalSettings === true}
                                    onChange={(e) =>
                                        handleCommandSettingChange(
                                            "discuss",
                                            "overridesGlobalSettings",
                                            e.target.checked
                                        )
                                    }
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="discuss-exclude-global" className="text-sm">
                                    Overrides global settings?
                                </Label>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent
                        value="edit"
                        className="data-[state=active]:mt-6 data-[state=active]:flex flex-col data-[state=active]:space-y-4 focus-visible:outline-none"
                        autoFocus={false}
                    >
                        <Label>
                            Custom slash commands
                            {editCommandCount > 0 && ` (${editCommandCount})`}
                        </Label>

                        <div
                            id="edit-commands"
                            className="overflow-y-auto max-h-[150px] space-y-3 p-1 pb-1"
                        >
                            {Object.entries(editSettings.commands || {}).map(
                                ([name, description], index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            value={name}
                                            onChange={(e) =>
                                                handleCommandNameChange("edit", name, e.target.value)
                                            }
                                            placeholder="Name"
                                            className="w-[90px]"
                                            ref={
                                                name === "" && description === ""
                                                    ? newCommandNameRef
                                                    : null
                                            }
                                        />
                                        <Textarea
                                            value={description}
                                            onChange={(e) =>
                                                handleCommandDescriptionChange(
                                                    "edit",
                                                    name,
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Description"
                                            className="min-h-[60px]"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600"
                                            onClick={() => handleDeleteCommand("edit", name)}
                                            disabled={
                                                Object.keys(editSettings.commands).length === 1 &&
                                                (name === "" || description === "")
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            )}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-green-700 hover:bg-green-800"
                            onClick={() => handleAddCommand("edit")}
                        >
                            <Plus /> Add command
                        </Button>

                        <div className="flex gap-4 pt-4">
                            <Label htmlFor="edit-instructions">Instructions</Label>
                            <Textarea
                                id="edit-instructions"
                                value={editSettings.instructions}
                                onChange={(e) =>
                                    handleCommandSettingChange(
                                        "edit",
                                        "instructions",
                                        e.target.value
                                    )
                                }
                                placeholder="Custom instructions for edit commands"
                            />
                        </div>

                        {scope === "document" && (
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="edit-exclude-global"
                                    checked={editSettings.overridesGlobalSettings === true}
                                    onChange={(e) =>
                                        handleCommandSettingChange(
                                            "edit",
                                            "overridesGlobalSettings",
                                            e.target.checked
                                        )
                                    }
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="edit-exclude-global" className="text-sm">
                                    Overrides global settings?
                                </Label>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent
                        value="talk"
                        className="data-[state=active]:grid grid-cols-[80px_1fr] gap-4 data-[state=active]:mt-6 items-center"
                    >
                        <Label htmlFor="voice">Voice</Label>
                        <Select
                            value={talkSettings.voice}
                            defaultValue="alloy"
                            onValueChange={(value) => handleTalkSettingChange("voice", value)}
                        >
                            <SelectTrigger id="voice">
                                <SelectValue placeholder="Select a voice..." />
                            </SelectTrigger>
                            <SelectContent>
                                {voiceOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Label htmlFor="persona">Persona</Label>
                        <Input
                            id="persona"
                            value={talkSettings.persona}
                            onChange={(e) =>
                                handleTalkSettingChange("persona", e.target.value)
                            }
                            placeholder="The voice assistant's personality"
                        />

                        <Label htmlFor="instructions" className="self-start pt-2">
                            Instructions
                        </Label>
                        <Textarea
                            id="instructions"
                            value={talkSettings.instructions}
                            onChange={(e) =>
                                handleTalkSettingChange("instructions", e.target.value)
                            }
                            placeholder="Custom instructions for the voice assistant"
                            rows={4}
                        />
                    </TabsContent>

                </Tabs>
                <DialogFooter>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfigureActionBarDialog;
