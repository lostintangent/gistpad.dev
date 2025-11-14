import { selectedGistAtom, selectedGistFileAtom } from "@/atoms";
import { MarkdownPreview } from "@/components/preview/MarkdownPreview";
import { ScrollToTop } from "@/components/preview/ScrollToTop";
import { ScrollableText } from "@/components/ScrollableText";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useMobile";
import {
  getDefaultFile,
  getGistById,
  getGistComments,
  getGistDisplayName,
} from "@/lib/github";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useAtom, useSetAtom } from "jotai";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Link,
  Pencil,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function View() {
  const [gistTitle, setGistTitle] = useState<string>("Loading...");
  const [copying, setCopying] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  const setSelectedGist = useSetAtom(selectedGistAtom);
  const [selectedGistFile, setSelectedGistFile] = useAtom(selectedGistFileAtom);

  const { gistId, filePath } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedHeading, setSelectedHeading] = useState(
    searchParams.get("heading")
  );

  // TODO: Share the same query client between the editor and share page
  const { data: gist, isLoading } = useQuery({
    queryKey: ["view-gist", gistId],
    queryFn: () => getGistById(gistId!),
    enabled: !!gistId,
    staleTime: 1000 * 60 * 2, // 5 minutes
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["gist-comments", gistId],
    queryFn: () => getGistComments(gistId!),
    enabled: !!gistId && (gist?.comments ?? 0) > 0,
  });

  const [headings, setHeadings] = useState<
    { id: string; text: string; level: number }[]
  >([]);

  // TODO: Move this into a common utility/hook
  // Extract headings from content when the preview ref or content changes
  useEffect(() => {
    if (!previewRef.current) return;

    // Find all headings within the content container
    const headingElements = previewRef.current.querySelectorAll(
      "h1, h2, h3, h4, h5, h6"
    );

    const extractedHeadings = Array.from(headingElements).map((heading) => {
      const id = heading.id;
      const text =
        heading.textContent?.replace(
          /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,
          ""
        ) || "";
      const level = parseInt(heading.tagName.slice(1));
      return { id, text, level };
    });

    const sanitizedHeadings =
      extractedHeadings.length > 0 &&
        extractedHeadings[extractedHeadings.length - 1].text
          .trim()
          .toLowerCase() === "footnotes"
        ? extractedHeadings.slice(0, -1)
        : extractedHeadings;

    setHeadings(sanitizedHeadings);
  }, [previewRef.current, gist?.files[selectedGistFile]?.content]);

  // Update the URL and scroll position when the user
  // selects a heading link in the page.
  useEffect(() => {
    if (!selectedHeading) {
      searchParams.delete("heading");
    } else {
      searchParams.set("heading", selectedHeading);

      // Add a slight delay to allow the preview to render
      setTimeout(() => {
        const headingElement = previewRef.current?.querySelector(
          `[id="${selectedHeading}"]`
        ) as HTMLElement | null;
        if (headingElement) {
          headingElement.scrollIntoView();
          headingElement.setAttribute("tabindex", "-1");
          headingElement.focus();
          handleCopyUrl();
        }
      }, 200);
    }

    setSearchParams(searchParams);
  }, [selectedHeading, previewRef.current]);

  const isMobile = useIsMobile();

  // Set the file to display
  useEffect(() => {
    if (gist) {
      setSelectedGist(gist);

      const selectedFile = filePath || getDefaultFile(gist);
      setSelectedGistFile(selectedFile);

      let title = getGistDisplayName(gist);
      if (selectedFile.toLowerCase() !== "readme.md") {
        const fileName = selectedFile.replace(".md", "");
        if (title.toLowerCase() !== fileName.toLowerCase()) {
          title += ` (${fileName})`;
        }
      }

      setGistTitle(title);
      document.title = `GistPad - ${title}`;
    }
  }, [gist, filePath]);

  function handleSelectFile(filename: string) {
    const file = filename.endsWith(".md") ? filename : `${filename}.md`;
    setSelectedGistFile(file);

    const filePath = file === "README.md" ? "" : `/${file}`;
    navigate(`/share/${gistId}${filePath}`);
  }

  const handleBackToApp = (quote?: string) => {
    // Selected gist is a global atom, and thereforem when we navigate
    // back to the editor, we need to clear it so that the editor knows
    // to load the selected gist based on the URL, not the atom.
    setSelectedGist(null);

    let path = `/${gistId}${selectedGistFile !== "README.md" ? `/${selectedGistFile}` : ""}`;

    // Add the quote parameter if provided
    if (quote) {
      path += `?quote=${encodeURIComponent(quote)}`;
    }

    if (gistId) {
      navigate(path);
    } else {
      navigate("/");
    }
  };

  const showCopyAnimation = () => {
    setCopying(true);
    setTimeout(() => {
      setCopying(false);
    }, 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    showCopyAnimation();
  };

  const handleCopyHtml = async () => {
    const { markdownToHtml } = await import("@/lib/markdown");
    await markdownToHtml(gist.files[selectedGistFile].content || "");
    showCopyAnimation();
  };

  const filteredFiles = Object.keys(gist?.files || {}).filter((filename) =>
    filename.endsWith(".md")
  );

  return (
    <div className="container max-w-4xl p-4">
      {/* Header */}
      <header className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0 mr-6">
            {!isLoading ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger>
                  <Button
                    variant="ghost"
                    className="h-10 gap-2 w-full items-center p-1!"
                  >
                    <h1 className="text-2xl font-bold flex-1 min-w-0 text-left">
                      <ScrollableText>{gistTitle}</ScrollableText>
                    </h1>
                    <ChevronDown className="h-4 w-4 mt-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {headings.length > 0 && (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                          <BookOpen className="h-4 w-4" />
                          Table of contents
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {headings.map((heading, index) => (
                            <DropdownMenuItem
                              key={`heading-${index}`}
                              onClick={() => setSelectedHeading(heading.id)}
                              style={{
                                paddingLeft: `${(heading.level - 1) * 0.5}rem`,
                              }}
                              className="gap-2"
                            >
                              {heading.text}
                              {heading.id === selectedHeading && (
                                <Check className="h-4 w-4 ml-auto" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuItem onClick={handleCopyUrl} className="gap-2">
                    <Link className="h-4 w-4" />
                    Copy URL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyHtml} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Copy as HTML
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleBackToApp()}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Open in editor
                  </DropdownMenuItem>

                  {filteredFiles.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                          <FileText className="h-4 w-4" />
                          Files in this gist...
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {filteredFiles.map((filename) => (
                            <DropdownMenuItem
                              key={filename}
                              onClick={() => handleSelectFile(filename)}
                              className={`gap-2${filename === selectedGistFile ? " bg-primary text-primary-foreground" : ""}`}
                            >
                              <FileText className="h-4 w-4" />
                              {filename.replace(/\.md$/, "")}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <h1 className="text-2xl font-bold flex-1 min-w-0">
                <ScrollableText>{gistTitle}</ScrollableText>
              </h1>
            )}
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <Button
                title="Copy URL"
                variant="outline"
                onClick={handleCopyUrl}
                className="gap-2"
              >
                {copying ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Link className="h-4 w-4" />
                )}
              </Button>
              <Button
                title="Open in editor"
                variant="outline"
                onClick={() => handleBackToApp()}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Open in editor
              </Button>
            </div>
          )}
        </div>

        {/* Author info and last updated time */}
        {!isLoading && gist?.owner && (
          <div className="flex items-center text-sm text-muted-foreground ml-1">
            <a
              href={`https://github.com/${gist.owner.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-foreground"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={gist.owner.avatar_url}
                  alt={gist.owner.login}
                />
                <AvatarFallback>
                  {gist.owner.login.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{gist.owner.login}</span>
            </a>
            <span className="mx-2">•</span>
            <Popover>
              <PopoverTrigger className="flex items-center gap-1 hover:text-foreground">
                <Calendar className="h-4 w-4" />
                Created{" "}
                {formatDistanceToNow(new Date(gist?.created_at), {
                  addSuffix: true,
                })}
              </PopoverTrigger>
              <PopoverContent className="w-50">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Created
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(gist?.created_at).toLocaleDateString("en-US", {
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
                      {formatDistanceToNow(new Date(gist.updated_at), {
                        addSuffix: true,
                      })}{" "}
                      ({new Date(gist.updated_at).toLocaleDateString("en-US")})
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </header>

      {/* Content */}
      <Card className="shadow-lg">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="p-5">
            <div ref={previewRef}>
              <MarkdownPreview
                onSelectFile={handleSelectFile}
                onSelectHeading={setSelectedHeading}
                contentContainerRef={previewRef}
                isReadonly={true}
                onAddComment={(selectedText) => handleBackToApp(selectedText)}
                comments={comments}
                showInlineComments={true}
              >
                {gist?.files[selectedGistFile]?.content || ""}
              </MarkdownPreview>
              <ScrollToTop isActionBarVisible={false} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
