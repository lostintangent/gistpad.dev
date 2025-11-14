import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ImageDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageDialog({ imageUrl, onClose }: ImageDialogProps) {
  return (
    <Dialog
      open={imageUrl !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent 
        className="p-0 border-none bg-transparent flex items-center justify-center cursor-pointer" 
        showCloseButton={false}
      >
        <img
          src={imageUrl || ""}
          className="max-h-[95vh] max-w-[95vw] object-contain"
          onClick={onClose}
          alt="Expanded view"
        />
      </DialogContent>
    </Dialog>
  );
}