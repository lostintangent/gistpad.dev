import { useUpdatePreferences } from "@/features/account/queries";
import { gistQueries } from "@/features/gists/queries";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { timeAgo } from "@/shared/dates";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingMessage } from "../../shared/LoadingMessage";
import { playChime } from "../../shared/chime";
import { updateGlobalSettings } from "../frontMatter/schema";

/**
 * Analyzes the user's writing style, based on a selection of their gists, so that it can
 * be saved as the agent's (global) instructions.
 */
export default function AnalyzeStyleDialog({
  gists,
  onClose,
}: {
  gists: Gist[];
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const updatePreferences = useUpdatePreferences();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const analysis = useMutation({
    mutationFn: async (gistIds: string[]) => {
      // The gist list doesn't include file contents, so load each of the gists first.
      const [{ analyzeStyle }, ...gists] = await Promise.all([
        import("../../openai"),
        ...gistIds.map((id) => queryClient.query(gistQueries.detail(id))),
      ]);
      return analyzeStyle(gists);
    },
    onSuccess: playChime,
    meta: { errorMessage: "Failed to analyze writing style" },
  });

  const saveAsInstructions = (instructions: string) => {
    updatePreferences((preferences) =>
      updateGlobalSettings(preferences, (settings) => ({
        ...settings,
        general: { ...settings.general, instructions },
      })),
    );
    toast.success("Saved as the agent's general instructions");
    onClose();
  };

  const toggle = (gistId: string, isSelected: boolean) =>
    setSelectedIds((ids) => (isSelected ? [...ids, gistId] : ids.filter((id) => id !== gistId)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-xl">
        <DialogHeader>
          <DialogTitle>Analyze writing style</DialogTitle>
        </DialogHeader>
        {analysis.isIdle ? (
          <>
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Select the gists to analyze:</p>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  <Checkbox
                    checked={selectedIds.length === gists.length}
                    onCheckedChange={(checked) =>
                      setSelectedIds(checked ? gists.map(({ id }) => id) : [])
                    }
                  />
                  Select all
                </label>
              </div>
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-4">
                  {gists.map((gist) => (
                    <label key={gist.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedIds.includes(gist.id)}
                        onCheckedChange={(checked) => toggle(gist.id, checked)}
                      />
                      <span className="flex-1 text-sm font-medium leading-none truncate">
                        {getGistDisplayName(gist)}
                      </span>
                      {!isMobile && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(gist.updated_at)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button
                onClick={() => analysis.mutate(selectedIds)}
                disabled={selectedIds.length === 0}
              >
                Analyze
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="pt-4">
              <ScrollArea className="h-[300px] rounded-md border px-4 py-2">
                {analysis.data ? (
                  <MarkdownPreview>{analysis.data}</MarkdownPreview>
                ) : (
                  <div className="flex items-center justify-center h-[280px]">
                    {analysis.isPending && <LoadingMessage />}
                  </div>
                )}
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={analysis.reset} disabled={analysis.isPending}>
                Analyze other gists
              </Button>
              {analysis.data ? (
                <Button onClick={() => saveAsInstructions(analysis.data)}>
                  Save as general instructions
                </Button>
              ) : (
                <Button onClick={onClose} disabled={analysis.isPending}>
                  Done
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
