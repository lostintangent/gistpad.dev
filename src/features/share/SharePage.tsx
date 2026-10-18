import { timeAgo } from "@/shared/dates";
import { CommentTooltips } from "@/features/comments/CommentTooltips";
import { useCommentThreads } from "@/features/comments/useCommentThreads";
import { readHeadings, scrollToHeading, type Heading } from "@/features/markdown/headings";
import { MarkdownPreview } from "@/features/markdown/MarkdownPreview";
import { ScrollToTop } from "@/features/markdown/ScrollToTop";
import { ScrollableText } from "@/shared/ScrollableText";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
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
import { Skeleton } from "@/shared/ui/skeleton";
import { useDocument, type GistDocument } from "@/features/editor/document";
import { useIsMobile } from "@/shared/useMediaQuery";
import { useTransientState } from "@/shared/useTransientState";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { queryClient } from "@/shared/query-client";
import { gistQueries } from "@/features/gists/queries";
import { shareRoute } from "@/router";
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
import { useEffect, useEffectEvent, useRef, useState } from "react";

/** The gist's name, plus the name of the open file (when it's not the gist's README). */
function getTitle(doc: GistDocument) {
  if (!doc.gist) return "Loading...";

  const name = getGistDisplayName(doc.gist);
  const file = doc.filename.replace(/\.md$/, "");
  return doc.filename === "README.md" || name.toLowerCase() === file.toLowerCase()
    ? name
    : `${name} (${file})`;
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
  const doc = useDocument();
  const { heading } = shareRoute.useSearch();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { quotedThreads } = useCommentThreads(doc);
  const [isCopied, setIsCopied] = useTransientState(false);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  const refresh = useMutation({
    mutationFn: () =>
      Promise.all([
        queryClient.refetchQueries({ queryKey: gistQueries.detail(doc.gistId!).queryKey }),
        queryClient.refetchQueries({ queryKey: gistQueries.comments(doc.gistId!).queryKey }),
      ]),
  });

  // When a link to a heading is opened, scroll to the heading (once the document has rendered).
  const scrollToLinkedHeading = useEffectEvent(() => {
    if (heading) scrollToHeading(previewRef.current, heading);
  });
  useEffect(() => {
    if (!doc.isLoading) scrollToLinkedHeading();
  }, [doc.documentKey, doc.isLoading]);

  const copyUrl = () => {
    navigator.clipboard.writeText(location.href);
    setIsCopied(true);
  };

  const copyHtml = async () => {
    const { copyAsHtml } = await import("@/features/markdown/toHtml");
    await copyAsHtml(doc.savedContent);
    setIsCopied(true);
  };

  const selectHeading = async (id: string) => {
    await navigate({ to: ".", search: { heading: id }, replace: true });
    scrollToHeading(previewRef.current, id);
    copyUrl();
  };

  // The open document, in the editor (e.g. to comment on a quote from it)
  const editorLink = linkOptions({
    to: "/{-$gistId}/{-$filePath}",
    params: { gistId: doc.gistId, filePath: doc.filename },
  });

  const openFile = (filename: string) =>
    navigate({
      to: "/share/$gistId/{-$filePath}",
      params: { gistId: doc.gistId!, filePath: filename },
    });

  const title = getTitle(doc);
  const files = Object.keys(doc.gist?.files ?? {}).filter((filename) => filename.endsWith(".md"));

  return (
    <div className="mx-auto max-w-4xl p-4">
      <title>{`GistPad - ${title}`}</title>

      <header className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0 mr-6">
            {doc.isLoading ? (
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
                                filename === doc.filename
                                  ? "bg-primary text-primary-foreground"
                                  : ""
                              }
                            >
                              <FileText /> {filename.replace(/\.md$/, "")}
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

        {doc.gist?.owner && (
          <div className="flex items-center text-sm text-muted-foreground ml-1">
            <a
              href={`https://github.com/${doc.gist.owner.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-foreground"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={doc.gist.owner.avatar_url} alt={doc.gist.owner.login} />
                <AvatarFallback>{doc.gist.owner.login[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{doc.gist.owner.login}</span>
            </a>
            <span className="mx-2">•</span>
            <GistDates gist={doc.gist} />
          </div>
        )}
      </header>

      <Card className="shadow-lg">
        {doc.isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div ref={previewRef} className="p-5">
            <MarkdownPreview
              files={files}
              onOpenFile={openFile}
              onSelectHeading={selectHeading}
              isReadOnly
              onAddComment={(quote) => navigate({ ...editorLink, search: { quote } })}
              comments={{ threads: quotedThreads }}
            >
              {doc.savedContent}
            </MarkdownPreview>
            <ScrollToTop isActionBarVisible={false} />
            <CommentTooltips threads={quotedThreads} />
          </div>
        )}
      </Card>
    </div>
  );
}
