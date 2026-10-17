import { SpotifyConfigDialog } from "@/features/spotify/SpotifyConfigDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useDocument, useOpenDocument } from "@/features/editor/document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useEditorThemes } from "@/features/editor/themes";
import {
  signOut,
  usePreferences,
  useSession,
  useUpdatePreferences,
  type Preferences,
} from "./queries";
import { formatDistanceToNow } from "date-fns";
import { Clock, LogOut, Music, Palette, Settings, Trash2 } from "lucide-react";
import { useState } from "react";

type BooleanPreference = {
  [Key in keyof Preferences]: Preferences[Key] extends boolean ? Key : never;
}[keyof Preferences];

const GENERAL_SETTINGS: [BooleanPreference, string][] = [
  ["isAutoSaveEnabled", "Auto-save changes"],
  ["isSpellcheckEnabled", "Enable spell checking"],
  ["showLineNumbers", "Show line numbers"],
];

const ADVANCED_SETTINGS: ([BooleanPreference, string] | null)[] = [
  ["showStarredGists", "Show starred gists"],
  ["showArchivedGists", "Show archived gists"],
  null,
  ["showDiffs", "Enable diff tracking"],
  ["showFrontmatter", "Show frontmatter"],
  ["showInlineComments", "Show inline comments"],
  ["showFormattingToolbar", "Show formatting toolbar"],
  null,
  ["pasteImagesAsHtml", "Paste images as HTML"],
];

/** The user's avatar, which opens a menu with their settings and recently viewed files. */
export function UserMenu() {
  const { user } = useSession();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const editorThemes = useEditorThemes();
  const openDocument = useOpenDocument();
  const doc = useDocument();
  const isMobile = useIsMobile();

  const [isSpotifyDialogOpen, setIsSpotifyDialogOpen] = useState(false);
  const [isClearRecentDialogOpen, setIsClearRecentDialogOpen] = useState(false);

  const settingItem = ([key, label]: [BooleanPreference, string]) => (
    <DropdownMenuCheckboxItem
      key={key}
      checked={preferences[key]}
      onCheckedChange={(checked) => updatePreferences({ [key]: checked })}
    >
      {label}
    </DropdownMenuCheckboxItem>
  );

  const { recentlyViewedGistFiles } = preferences;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" className="rounded-full" />}
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl} />
            <AvatarFallback>{user?.initial}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {recentlyViewedGistFiles.length > 0 && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Clock />
                  Recently viewed
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                  {recentlyViewedGistFiles.map((file) => {
                    const isOpen = file.id === doc.gistId && file.filename === doc.filename;

                    return (
                      <DropdownMenuItem
                        key={`${file.id}-${file.filename}`}
                        onClick={() => openDocument(file.id, file.filename)}
                        className={isOpen ? "bg-primary text-primary-foreground" : ""}
                      >
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-medium">{file.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(file.viewedDate, { addSuffix: true })}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsClearRecentDialogOpen(true)}>
                    <Trash2 className="text-red-500" />
                    Clear recent list
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}

          {GENERAL_SETTINGS.map(settingItem)}
          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette />
              Editor theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={preferences.editorTheme}
                onValueChange={(editorTheme) => updatePreferences({ editorTheme })}
              >
                {Object.keys(editorThemes).map((themeName) => (
                  <DropdownMenuRadioItem key={themeName} value={themeName}>
                    {themeName}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Settings />
              Advanced settings
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {ADVANCED_SETTINGS.map((setting, index) =>
                setting ? settingItem(setting) : <DropdownMenuSeparator key={index} />,
              )}
              {!isMobile && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsSpotifyDialogOpen(true)}>
                    <Music />
                    Configure Spotify...
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SpotifyConfigDialog open={isSpotifyDialogOpen} onOpenChange={setIsSpotifyDialogOpen} />

      <AlertDialog open={isClearRecentDialogOpen} onOpenChange={setIsClearRecentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recently viewed files</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear your recently viewed files?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                updatePreferences({ recentlyViewedGistFiles: [] });
                setIsClearRecentDialogOpen(false);
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
