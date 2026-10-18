import { MessageSquare } from "lucide-react";
import { useEffect, useEffectEvent, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { SELECTION_COMMENT } from "@/features/comments/threads";

/** A floating button for commenting on the text the user selected in the preview. */
export function SelectionCommentButton({
  containerRef,
  onComment,
}: {
  containerRef: RefObject<HTMLElement | null>;
  onComment: (selectedText: string) => void;
}) {
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(
    null,
  );

  const updateSelection = useEffectEvent(() => {
    const current = window.getSelection();
    const text = current?.toString() ?? "";
    const range = current?.isCollapsed === false ? current.getRangeAt(0) : null;

    if (
      !range ||
      text.trim().length < SELECTION_COMMENT.minLength ||
      !containerRef.current?.contains(range.commonAncestorContainer)
    ) {
      setSelection(null);
      return;
    }

    const { top, left } = range.getBoundingClientRect();
    setSelection({ text, top: top - 30, left });
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeout: ReturnType<typeof setTimeout>;
    const onMouseUp = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateSelection, SELECTION_COMMENT.delay);
    };
    const onMouseDown = () => setSelection(null);

    container.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      clearTimeout(timeout);
      container.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [containerRef]);

  if (!selection) return null;

  return createPortal(
    <button
      className="fixed z-50 p-1 bg-primary text-primary-foreground rounded-md shadow-md hover:bg-primary/90 transition-colors"
      style={{ top: selection.top, left: selection.left }}
      title={SELECTION_COMMENT.title}
      // Prevent the document's mousedown handler from dismissing the button, before it's clicked
      onMouseDown={(event) => event.stopPropagation()}
      onClick={() => {
        onComment(selection.text);
        setSelection(null);
      }}
    >
      <MessageSquare className="h-4 w-4" />
    </button>,
    document.body,
  );
}
