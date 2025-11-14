import { analyzeStyle } from "@/agents/analyze";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/useMobile";
import { getGistById, Gist } from "@/lib/github";
import { playAiChime } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { AiLoadingMessage } from "../../../AiLoadingMessage";

interface AnalyzeStyleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gists: Gist[];
}

const AnalyzeStyleDialog = ({
  isOpen,
  onOpenChange,
  gists,
}: AnalyzeStyleDialogProps) => {
  const isMobile = useIsMobile();
  const [selectedGists, setSelectedGists] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string | null>(null);

  const handleExtract = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      let selectedGistObjects = gists.filter((gist) =>
        selectedGists.includes(gist.id)
      );

      // Check if any gists need their content loaded
      const gistsToLoad = selectedGistObjects.filter((gist) =>
        Object.values(gist.files).some((file) => !file.content)
      );

      // Fetch full content for any gists that need it
      if (gistsToLoad.length > 0) {
        const loadedGists = await Promise.all(
          gistsToLoad.map((gist) => getGistById(gist.id))
        );

        // Replace the incomplete gists with their fully loaded versions
        selectedGistObjects = selectedGistObjects.map((gist) =>
          gistsToLoad.find((g) => g.id === gist.id)
            ? loadedGists.find((g) => g.id === gist.id)!
            : gist
        );

        // Update the main gists array with the fully loaded versions
        gists = gists.map(
          (gist) => loadedGists.find((g) => g.id === gist.id) || gist
        );
      }
      const analysis = await analyzeStyle(selectedGistObjects);
      playAiChime();
      setResults(analysis);
    } catch (error) {
      toast.error("Failed to analyze writing style");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedGists([]);
    setResults(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-xl">
        <DialogHeader>
          <DialogTitle>Analyze writing style</DialogTitle>
        </DialogHeader>

        <div className="pt-4">
          {!isLoading && !results ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Select the gists to analyze:
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedGists.length === gists.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedGists(gists.map((gist) => gist.id));
                      } else {
                        setSelectedGists([]);
                      }
                    }}
                  />
                  <label
                    htmlFor="select-all"
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                  >
                    Select all
                  </label>
                </div>
              </div>
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-4">
                  {gists.map((gist) => (
                    <div key={gist.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={gist.id}
                        checked={selectedGists.includes(gist.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGists((prev) => [...prev, gist.id]);
                          } else {
                            setSelectedGists((prev) =>
                              prev.filter((id) => id !== gist.id)
                            );
                          }
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
                        <label
                          htmlFor={gist.id}
                          className="text-sm font-medium leading-none cursor-pointer truncate"
                        >
                          {gist.description ||
                            Object.keys(gist.files)[0]?.replace(".md", "") || "Empty"}
                        </label>
                        {!isMobile && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(gist.updated_at), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <ScrollArea className="h-[300px] rounded-md border px-4 py-2 max-w-none">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <AiLoadingMessage />
                  </div>
                ) : (
                  <MarkdownPreview>{results}</MarkdownPreview>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          {results || isLoading ? (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isLoading}
              >
                Analyze other gists
              </Button>
              <Button onClick={() => onOpenChange(false)} disabled={isLoading}>
                Done
              </Button>
            </>
          ) : (
            <Button
              onClick={handleExtract}
              disabled={selectedGists.length === 0 || isLoading}
            >
              Analyze
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnalyzeStyleDialog;
