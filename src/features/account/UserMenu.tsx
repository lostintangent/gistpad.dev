import { timeAgo } from "@/shared/dates";
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
import { Skeleton } from "@/shared/ui/skeleton";
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
import { useActiveFile, openFile } from "@/features/files/file";
import { closeMobilePanels } from "@/features/workbench/layout/state";
import type { Command } from "@/features/commands/command";
import { CommandDropdownItem } from "@/features/commands/CommandDropdownItem";
import { executeCommand } from "@/features/commands/registry";
import { usePreferences, useSession, useUpdatePreferences } from "./queries";
import { useAccountSettingsCommands } from "./settings";
import { Clock, Settings, Trash2 } from "lucide-react";
import { useState } from "react";

/**
 * The user's avatar, which opens a menu with their settings and recently viewed files (either
 * above it, in the sidebar's footer, or beside it, in the collapsed sidebar's rail).
 */
export function UserMenu({ side }: { side: "top" | "right" }) {
  const { user } = useSession();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const file = useActiveFile();
  const commands = useAccountSettingsCommands();

  const [isClearRecentDialogOpen, setIsClearRecentDialogOpen] = useState(false);

  const settingItem = (command: Command) => (
    <DropdownMenuCheckboxItem
      key={command.id}
      checked={command.checked}
      onCheckedChange={() => void executeCommand(command)}
    >
      {command.title}
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
            <AvatarFallback className="text-xs">
              {user?.initial ?? <Skeleton className="size-full rounded-full" />}
            </AvatarFallback>
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
                  {recentlyViewedGistFiles.map((recent) => {
                    const isOpen = recent.id === file.gistId && recent.filename === file.filename;

                    return (
                      <DropdownMenuItem
                        key={`${recent.id}-${recent.filename}`}
                        onClick={() => {
                          // (Even if it's already open, e.g. to return to it from the mobile gist list)
                          closeMobilePanels();
                          openFile(recent.id, recent.filename);
                        }}
                        className={isOpen ? "bg-primary text-primary-foreground" : ""}
                      >
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-medium">{recent.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(recent.viewedDate)}
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

          {commands.general.map(settingItem)}
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
              {commands.advanced.map((setting, index) =>
                setting ? settingItem(setting) : <DropdownMenuSeparator key={index} />,
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <CommandDropdownItem command="account.signOut" />
        </DropdownMenuContent>
      </DropdownMenu>

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
