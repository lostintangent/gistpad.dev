import { scrollToHeading } from "@/features/markdown/headings";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { ScrollToTop } from "@/features/markdown/ScrollToTop";
import { readDocumentContent, useOpenDocument, type GistDocument } from "./document";
import { useSelectedHeading } from "./mode";
import { useGists } from "@/features/gists/queries";
import { usePreferences } from "@/features/account/queries";
import { commentsStore, openComments } from "@/features/comments/store";
import { updateDraft } from "./store";
import { useSelector } from "@tanstack/react-store";
import { useDeferredValue, useEffect, useEffectEvent, type RefObject } from "react";
import { useCommentThreads } from "@/features/comments/useCommentThreads";

/** Toggles a task list item (identified by its text) between complete and incomplete. */
function toggleTask(content: string, text: string) {
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const task = new RegExp(`^(\\s*[-+*]\\s+\\[)([\\sxX])(\\]\\s*${escapedText})$`, "m");

  return content.replace(
    task,
    (_, prefix, state: string, suffix) =>
      `${prefix}${state.trim().toLowerCase() === "x" ? " " : "x"}${suffix}`,
  );
}

export function PreviewPane({
  doc,
  content,
  isViewingRevision,
  showActionBar,
  ref,
}: {
  doc: GistDocument;
  content: string;
  isViewingRevision: boolean;
  /** Whether the action bar is shown (over the bottom of the preview). */
  showActionBar: boolean;
  ref: RefObject<HTMLDivElement | null>;
}) {
  const { gists } = useGists();
  const { showInlineComments } = usePreferences();
  const openDocument = useOpenDocument();
  const [heading, selectHeading] = useSelectedHeading();
  const { quotedThreads } = useCommentThreads(doc);
  const selectedCommentId = useSelector(commentsStore, (state) => state.selectedCommentId);

  // Rendering markdown is relatively slow, so let it lag behind typing (in split mode)
  const deferredContent = useDeferredValue(content);

  // When a link to a heading is opened, scroll to the heading (once the document has rendered).
  const scrollToLinkedHeading = useEffectEvent(() => {
    if (heading) scrollToHeading(ref.current, heading);
  });
  useEffect(() => scrollToLinkedHeading(), [doc.documentKey]);

  return (
    <div ref={ref} className="overflow-y-auto p-4 h-full">
      <MarkdownPreview
        files={Object.keys(doc.gist?.files ?? {})}
        onOpenFile={(filename) => openDocument(doc.gistId, filename)}
        gists={gists}
        onOpenGist={(gistId) => openDocument(gistId)}
        onSelectHeading={async (id) => {
          await selectHeading(id);
          scrollToHeading(ref.current, id);
          navigator.clipboard.writeText(location.href);
        }}
        onToggleTask={(text) =>
          updateDraft(doc.documentKey, doc.savedContent, {
            content: toggleTask(readDocumentContent(doc), text),
          })
        }
        onAddComment={(text) => openComments({ quote: text })}
        comments={
          showInlineComments && !isViewingRevision
            ? { threads: quotedThreads, selectedId: selectedCommentId }
            : undefined
        }
        isReadOnly={doc.isReadOnly || isViewingRevision}
        scrollPastEnd={showActionBar}
      >
        {deferredContent}
      </MarkdownPreview>
      <ScrollToTop isActionBarVisible={showActionBar} />
    </div>
  );
}
