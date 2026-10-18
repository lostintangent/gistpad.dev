import { useLinkedHeading } from "@/features/markdown/headings";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { ScrollToTop } from "@/features/markdown/ScrollToTop";
import {
  getWhiteboard,
  readDocumentContent,
  useDocumentContent,
  openDocument,
  type GistDocument,
} from "./document";
import type { Revision } from "./history/revision";
import { useGists } from "@/features/gists/queries";
import { openComments } from "@/features/comments/store";
import { updateDraft } from "./store";
import { useDeferredValue, type RefObject } from "react";
import { useCommentHighlights } from "@/features/comments/useCommentThreads";

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
  revision,
  showActionBar,
  ref,
}: {
  doc: GistDocument;
  /** The past revision that's being viewed (if any), which is shown read-only. */
  revision: Revision | null;
  /** Whether the action bar is shown (over the bottom of the preview). */
  showActionBar: boolean;
  ref: RefObject<HTMLDivElement | null>;
}) {
  const documentContent = useDocumentContent(doc);
  const { gists } = useGists();
  const [, selectHeading] = useLinkedHeading(ref, doc);
  const commentHighlights = useCommentHighlights(doc);

  // Rendering markdown is relatively slow, so let it lag behind typing (in split mode)
  const deferredContent = useDeferredValue(revision?.content ?? documentContent);

  return (
    <div ref={ref} className="overflow-y-auto p-4 h-full">
      <MarkdownPreview
        files={Object.keys(doc.gist?.files ?? {})}
        onOpenFile={(filename) => openDocument(doc.gistId, filename)}
        gists={gists}
        onOpenGist={(gistId) => openDocument(gistId)}
        onSelectHeading={selectHeading}
        onToggleTask={(text) =>
          updateDraft(doc, { content: toggleTask(readDocumentContent(doc), text) })
        }
        onAddComment={(text) => openComments({ quote: text })}
        commentHighlights={commentHighlights}
        whiteboard={getWhiteboard(doc)}
        isReadOnly={doc.isReadOnly || !!revision}
        scrollPastEnd={showActionBar}
      >
        {deferredContent}
      </MarkdownPreview>
      <ScrollToTop isActionBarVisible={showActionBar} />
    </div>
  );
}
