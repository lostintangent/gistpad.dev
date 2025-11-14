import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { MediaItem } from "./types";

interface MediaDialogProps {
  media: string | MediaItem | MediaItem[] | null;
  onClose: () => void;
}

export function MediaDialog({ media, onClose }: MediaDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    setCurrentIndex(0);
  }, [media]);

  const mediaArray = useMemo(() => {
    const item =
      typeof media === "string" ? { type: "image" as const, url: media } : media;
    return Array.isArray(item) ? item : item ? [item] : [];
  }, [media]);

  const hasMultiple = mediaArray.length > 1;
  const currentMedia = mediaArray[currentIndex];

  // Preload images in the gallery so navigation feels instant
  useEffect(() => {
    mediaArray.forEach((item) => {
      if (item.type === "image") {
        const img = new Image();
        img.src = item.url;
      }
    });
  }, [mediaArray]);

  /* Logic for syncing audio and video playback */
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRefCallback = (video: HTMLVideoElement | null) => {
    if (!video || currentMedia?.type !== "video" || !currentMedia?.audioUrl) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      audio.currentTime = video.currentTime;
      audio.play();
    };

    const handlePause = () => audio.pause();
    const handleSeeked = () => (audio.currentTime = video.currentTime);

    const handleVolumeChange = () => {
      audio.volume = video.volume;
      audio.muted = video.muted;
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("volumechange", handleVolumeChange);

    audio.volume = video.volume;
    audio.muted = video.muted;

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("volumechange", handleVolumeChange);
      audio.pause();
    };
  };

  /* Logic for handling image gallery navigation */
  const handlePrevious = useCallback(
    () =>
      setCurrentIndex(
        (prev) => (prev - 1 + mediaArray.length) % mediaArray.length
      ),
    [mediaArray.length]
  );

  const handleNext = useCallback(
    () => setCurrentIndex((prev) => (prev + 1) % mediaArray.length),
    [mediaArray.length]
  );

  useEffect(() => {
    if (media === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        // Suppress this event from scrolling the dashboard
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasMultiple) {
        handlePrevious();
      } else if (e.key === "ArrowRight" && hasMultiple) {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media, hasMultiple, handleNext, handlePrevious, onClose]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (hasMultiple) {
        handleNext();
      }
    },
    onSwipedRight: () => {
      if (hasMultiple) {
        handlePrevious();
      }
    },
    onSwipedDown: onClose,
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  return (
    <Dialog
      open={media !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        {...swipeHandlers}
        className="p-0 border-none bg-transparent flex items-center justify-center"
        showCloseButton={false}
      >
        <div
          className="relative max-h-[95vh] max-w-[95vw] flex items-center justify-center"
        >
          {currentMedia?.type === "video" ? (
            <>
              {currentMedia.audioUrl && (
                <audio
                  key={currentMedia.audioUrl}
                  ref={audioRef}
                  src={currentMedia.audioUrl}
                  style={{ display: "none" }}
                />
              )}
              <video
                key={currentMedia.url}
                ref={videoRefCallback}
                src={currentMedia.url}
                poster={currentMedia.posterUrl}
                controls
                autoPlay
                className="max-h-[95vh] max-w-[95vw] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </>
          ) : currentMedia.type === "embed" ? (
            <iframe
              src={currentMedia.src}
              className="w-[90vw] h-[90vh] max-w-5xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              key={currentMedia.url}
              src={currentMedia.url}
              className="max-h-[95vh] max-w-[95vw] object-contain cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              alt="Expanded view"
            />
          )}

          {/* Navigation buttons for image galleries */}
          {hasMultiple && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {mediaArray.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
