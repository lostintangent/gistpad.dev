import { timeAgo } from "@/shared/dates";
import { CommentTooltips } from "@/features/comments/CommentTooltips";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { readHeadings, useLinkedHeading, type Heading } from "@/features/markdown/headings";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { ScrollToTop } from "@/features/markdown/ScrollToTop";
import { ScrollableText } from "@/shared/ScrollableText";
import { UserAvatar } from "@/shared/UserAvatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { getWhiteboard, useActiveFile, type ActiveFile } from "@/features/files/file";
import LoadingSkeleton from "@/shared/LoadingSkeleton";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useTransientState } from "@/shared/useTransientState";
import {
  getFileDisplayName,
  getGistDisplayName,
  getMarkdownFiles,
  type Gist,
} from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import { gistQueries } from "@/features/gists/queries";
import { useMutation } from "@tanstack/react-query";
import { Link, linkOptions, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Link as LinkIcon,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useRef, useState } from "react";

/** The gist's name, plus the name of the open file (when it's not the gist's README). */
function getTitle(file: ActiveFile) {
  if (!file.gist) return "Loading...";

  const name = getGistDisplayName(file.gist);
  const fileName = getFileDisplayName(file.filename);
  return file.isReadme || name.toLowerCase() === fileName.toLowerCase()
    ? name
    : `${name} (${fileName})`;
}

function GistDates({ gist }: { gist: Gist }) {
  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-1 hover:text-foreground">
        <Calendar className="h-4 w-4" />
        Created {timeAgo(gist.created_at)}
      </PopoverTrigger>
      <PopoverContent className="w-50">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created
            </h4>
            <p className="text-sm text-muted-foreground">
              {new Date(gist.created_at).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium leading-none flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last updated
            </h4>
            <p className="text-sm text-muted-foreground">
              {timeAgo(gist.updated_at)} ({new Date(gist.updated_at).toLocaleDateString("en-US")})
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A read-only view of a gist, which can be shared with other people. */
export default function Share() {
  const file = useActiveFile();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { quotedThreads } = useCommentThreads(file);
  const [isCopied, setIsCopied] = useTransientState(false);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  const refresh = useMutation({
    mutationFn: () =>
      Promise.all([
        queryClient.refetchQueries({ queryKey: gistQueries.detail(file.gistId!).queryKey }),
        queryClient.refetchQueries({ queryKey: gistQueries.comments(file.gistId!).queryKey }),
      ]),
  });

  const [heading, linkHeading] = useLinkedHeading(previewRef, file);

  const copyUrl = () => {
    navigator.clipboard.writeText(location.href);
    setIsCopied(true);
  };

  const copyHtml = async () => {
    const { copyAsHtml } = await import("@/features/markdown/toHtml");
    await copyAsHtml(file.savedContent);
    setIsCopied(true);
  };

  const selectHeading = async (id: string) => {
    await linkHeading(id);
    setIsCopied(true);
  };

  // The active file, in the editor (e.g. to comment on a quote from it)
  const editorLink = linkOptions({
    to: "/{-$gistId}/{-$filePath}",
    params: { gistId: file.gistId, filePath: file.filename },
  });

  const openFile = (filename: string) =>
    navigate({
      to: "/share/$gistId/{-$filePath}",
      params: { gistId: file.gistId!, filePath: filename },
    });

  const title = getTitle(file);
  const files = getMarkdownFiles(file.gist);

  return (
    <div className="mx-auto max-w-4xl p-4">
      <title>{`GistPad - ${title}`}</title>

      <header className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0 mr-6">
            {file.isLoading ? (
              <h1 className="text-2xl font-bold flex-1 min-w-0">{title}</h1>
            ) : (
              <DropdownMenu
                modal={false}
                // The table of contents reflects the rendered document
                onOpenChange={(open) => open && setHeadings(readHeadings(previewRef.current))}
              >
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" className="h-10 gap-2 w-full items-center p-1!" />
                  }
                >
                  <h1 className="text-2xl font-bold flex-1 min-w-0 text-left">
                    <ScrollableText>{title}</ScrollableText>
                  </h1>
                  <ChevronDown className="h-4 w-4 mt-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {headings.length > 0 && (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <BookOpen /> Table of contents
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {headings.map(({ id, text, level }) => (
                            <DropdownMenuItem
                              key={id}
                              onClick={() => selectHeading(id)}
                              style={{ paddingLeft: `${(level - 1) * 0.5}rem` }}
                            >
                              {text}
                              {id === heading && <Check className="ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={copyUrl}>
                    <LinkIcon /> Copy URL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyHtml}>
                    <FileText /> Copy as HTML
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link {...editorLink} />}>
                    <Pencil /> Open in editor
                  </DropdownMenuItem>
                  {files.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FileText /> Files in this gist...
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {files.map((filename) => (
                            <DropdownMenuItem
                              key={filename}
                              onClick={() => openFile(filename)}
                              className={
                                filename === file.filename
                                  ? "bg-primary text-primary-foreground"
                                  : ""
                              }
                            >
                              <FileText /> {getFileDisplayName(filename)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    // Keep the menu open, so the refresh's progress is visible
                    closeOnClick={false}
                    onClick={() => refresh.mutate()}
                    disabled={refresh.isPending}
                  >
                    <RefreshCw className={refresh.isPending ? "animate-spin" : ""} /> Refresh
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <Button title="Copy URL" variant="outline" onClick={copyUrl}>
                {isCopied ? <Check className="text-green-500" /> : <LinkIcon />}
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link {...editorLink} />}>
                <Pencil /> Open in editor
              </Button>
            </div>
          )}
        </div>

        {file.gist?.owner && (
          <div className="flex items-center text-sm text-muted-foreground ml-1">
            <a
              href={`https://github.com/${file.gist.owner.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-foreground"
            >
              <UserAvatar user={file.gist.owner} size="sm" />
              <span className="font-medium">{file.gist.owner.login}</span>
            </a>
            <span className="mx-2">•</span>
            <GistDates gist={file.gist} />
          </div>
        )}
      </header>

      <Card className="shadow-lg">
        {file.isLoading ? (
          <div className="p-6">
            <LoadingSkeleton />
          </div>
        ) : (
          <div ref={previewRef} className="p-5">
            <MarkdownPreview
              files={files}
              onOpenFile={openFile}
              onSelectHeading={selectHeading}
              isReadOnly
              onAddComment={(quote) => navigate({ ...editorLink, search: { quote } })}
              commentHighlights={{ threads: quotedThreads }}
              whiteboard={getWhiteboard(file)}
            >
              {file.savedContent}
            </MarkdownPreview>
            <ScrollToTop />
            <CommentTooltips threads={quotedThreads} />
          </div>
        )}
      </Card>
    </div>
  );
}
