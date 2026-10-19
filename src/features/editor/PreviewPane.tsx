import { useLinkedHeading } from "@/features/markdown/headings";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { ScrollToTop } from "@/features/markdown/ScrollToTop";
import {
  getWhiteboard,
  readFileContent,
  useActiveFile,
  useFileContent,
  openFile,
} from "@/features/files/file";
import type { Revision } from "./history/revision";
import { useGists } from "@/features/gists/queries";
import { openComments } from "@/features/comments/store";
import { updateDraft } from "@/features/files/draft";
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
  revision,
  showComposer,
  ref,
}: {
  /** The past revision that's being viewed (if any), which is shown read-only. */
  revision: Revision | null;
  /** Whether the composer is shown (over the bottom of the preview). */
  showComposer: boolean;
  ref: RefObject<HTMLDivElement | null>;
}) {
  const file = useActiveFile();
  const documentContent = useFileContent(file);
  const { gists } = useGists();
  const [, selectHeading] = useLinkedHeading(ref, file);
  const commentHighlights = useCommentHighlights(file);

  // Rendering markdown is relatively slow, so let it lag behind typing (in split mode)
  const deferredContent = useDeferredValue(revision?.content ?? documentContent);

  return (
    <div ref={ref} className="overflow-y-auto p-4 h-full">
      <MarkdownPreview
        files={Object.keys(file.gist?.files ?? {})}
        onOpenFile={(filename) => openFile(file.gistId, filename)}
        gists={gists}
        onOpenGist={(gistId) => openFile(gistId)}
        onSelectHeading={selectHeading}
        onToggleTask={(text) =>
          updateDraft(file, { content: toggleTask(readFileContent(file), text) })
        }
        onAddComment={(text) => openComments({ quote: text })}
        commentHighlights={commentHighlights}
        whiteboard={getWhiteboard(file)}
        isReadOnly={file.isReadOnly || !!revision}
        scrollPastEnd={showComposer}
      >
        {deferredContent}
      </MarkdownPreview>
      <ScrollToTop isComposerVisible={showComposer} />
    </div>
  );
}
