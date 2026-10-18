import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { useEffect, useEffectEvent } from "react";
import { useSwipeable } from "react-swipeable";

export type Media =
  { type: "image"; url: string } | { type: "video"; url: string; posterUrl?: string };

/** Displays an image or video, which is mounted while it's open. */
export function MediaDialog({ media, onClose }: { media: Media; onClose: () => void }) {
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Suppress this event from scrolling the dashboard
      e.preventDefault();
      onClose();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const swipeHandlers = useSwipeable({
    onSwipedDown: onClose,
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="p-0 border-none bg-transparent flex items-center justify-center"
        showCloseButton={false}
      >
        <div
          {...swipeHandlers}
          className="max-h-[95vh] max-w-[95vw] flex items-center justify-center"
        >
          {media.type === "video" ? (
            <video
              src={media.url}
              poster={media.posterUrl}
              controls
              autoPlay
              className="max-h-[95vh] max-w-[95vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={media.url}
              className="max-h-[95vh] max-w-[95vw] object-contain cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              alt="Expanded view"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
