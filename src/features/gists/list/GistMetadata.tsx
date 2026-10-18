import { Badge } from "@/shared/ui/badge";
import { getMarkdownFiles, isDateBasedGist, type Gist } from "@/shared/github";
import { timeAgo } from "@/shared/dates";
import { Calendar, File, Globe, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

/** The details shown below a gist's name in the gist list (e.g. when it was last updated). */
export function GistMetadata({
  gist,
  hasIndicator = false,
  children,
}: {
  gist: Gist;
  /** Shows a dot that indicates the gist needs attention (e.g. it has unsaved changes). */
  hasIndicator?: boolean;
  children?: ReactNode;
}) {
  const isDateBased = isDateBasedGist(gist);
  const FileIcon = isDateBased ? Calendar : File;

  // The README of a date-based gist isn't counted, since it isn't one of its dated files
  const markdownFiles = getMarkdownFiles(gist);
  const fileCount = markdownFiles.length - (isDateBased && gist.files["README.md"] ? 1 : 0);

  return (
    <div className="text-sm text-muted-foreground flex items-center gap-2">
      {hasIndicator && <span className="bg-blue-500 rounded-full w-2 h-2" />}
      {timeAgo(gist.updated_at)}
      {gist.public && (
        <Badge variant="count" title="Public gist">
          <Globe />
        </Badge>
      )}
      {(fileCount > 1 || isDateBased) && (
        <Badge variant="count" title={`${fileCount} files`}>
          {fileCount}
          <FileIcon />
        </Badge>
      )}
      {gist.comments > 0 && (
        <Badge variant="count" title={`${gist.comments} comments`}>
          {gist.comments}
          <MessageSquare />
        </Badge>
      )}
      {children}
    </div>
  );
}
