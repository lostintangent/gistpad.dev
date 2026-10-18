import { timeAgo } from "@/shared/dates";
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useDocument, openDocument } from "@/features/editor/document";
import { useIsMobile } from "@/shared/useMediaQuery";
import {
  signOut,
  usePreferences,
  useSession,
  useUpdatePreferences,
  type Preferences,
} from "./queries";
import { Clock, LogOut, Music, Settings, Trash2 } from "lucide-react";
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

/**
 * The user's avatar, which opens a menu with their settings and recently viewed files (either
 * above it, in the sidebar's footer, or beside it, in the collapsed sidebar's rail).
 */
export function UserMenu({ side }: { side: "top" | "right" }) {
  const { user } = useSession();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
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
          render={<Button variant="ghost" size="icon" className="size-6 rounded-full" />}
          aria-label="User menu"
        >
          <Avatar className="size-5">
            <AvatarImage src={user?.avatarUrl} />
            <AvatarFallback className="text-xs">{user?.initial}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={side === "top" ? "start" : "end"}>
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
                            {timeAgo(file.viewedDate)}
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

          {/* The item is covered by a color input, so that clicking it opens the color picker */}
          <DropdownMenuItem
            closeOnClick={false}
            className="relative"
            onClick={(e) =>
              e.target === e.currentTarget && e.currentTarget.querySelector("input")?.click()
            }
          >
            <span className="size-4 rounded-full border border-black/10 bg-accent" />
            Accent color
            <input
              type="color"
              aria-label="Accent color"
              defaultValue={preferences.accentColor}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              // The color is previewed while it's being picked, and saved once it's chosen
              onInput={(e) =>
                document.documentElement.style.setProperty("--accent", e.currentTarget.value)
              }
              ref={(input) => {
                const save = () => input && updatePreferences({ accentColor: input.value });
                input?.addEventListener("change", save);
                return () => input?.removeEventListener("change", save);
              }}
            />
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Settings />
              Advanced settings
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
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
