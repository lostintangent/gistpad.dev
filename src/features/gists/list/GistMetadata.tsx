import { Badge } from "@/shared/ui/badge";
import type { Gist } from "@/shared/github";
import { isDateBasedGist } from "@/shared/dates";
import { formatDistanceToNow } from "date-fns";
import { Calendar, File, Globe, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

/** The details shown below a gist's name in the gist list (e.g. when it was last updated). */
export function GistMetadata({
  gist,
  showPublicBadge = true,
  hasIndicator = false,
  children,
}: {
  gist: Gist;
  showPublicBadge?: boolean;
  /** Shows a dot that indicates the gist needs attention (e.g. it has unsaved changes). */
  hasIndicator?: boolean;
  children?: ReactNode;
}) {
  const isDateBased = isDateBasedGist(gist);
  const FileIcon = isDateBased ? Calendar : File;

  // The README of a date-based gist isn't counted, since it isn't one of its dated files
  const markdownFiles = Object.keys(gist.files).filter((filename) => filename.endsWith(".md"));
  const fileCount = markdownFiles.length - (isDateBased && gist.files["README.md"] ? 1 : 0);

  return (
    <div className="text-sm text-muted-foreground flex items-center gap-2">
      {hasIndicator && <span className="bg-blue-500 rounded-full w-2 h-2" />}
      {formatDistanceToNow(gist.updated_at, { addSuffix: true })}
      {showPublicBadge && gist.public && (
        <Badge variant="secondary" title="Public gist">
          <Globe className="h-3.5 w-3.5" />
        </Badge>
      )}
      {(fileCount > 1 || isDateBased) && (
        <Badge variant="secondary" title={`${fileCount} files`}>
          {fileCount}
          <FileIcon className="ml-1 h-3.5 w-3.5" />
        </Badge>
      )}
      {gist.comments > 0 && (
        <Badge variant="secondary" title={`${gist.comments} comments`}>
          {gist.comments}
          <MessageSquare className="ml-1 h-3.5 w-3.5" />
        </Badge>
      )}
      {children}
    </div>
  );
}
