import { selectedGistFilesAtom } from "@/atoms";
import { ImageDialog } from "@/components/preview/ImageDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Gist, GistComment } from "@/lib/github";
import {
  cn,
  decodeHtmlEntities,
  evaluateMathExpression,
  extractVariableAssignments,
} from "@/lib/utils";
import emojiData from "@emoji-mart/data/sets/15/native.json";
import { useAtomValue } from "jotai";
import { Check, Copy, Link } from "lucide-react";
import * as React from "react";
import {
  Children,
  createElement,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkGithubAlerts from "remark-github-alerts";
import { processBookmarks, resetBookmarkCounter } from "./bookmarks";
import Mermaid from "./Mermaid";
import { TLDraw } from "./TLDraw";
import { TOC } from "./TOC";
import { processWikilinks } from "./wikilinks";

import { Checkbox } from "@/components/ui/checkbox";
import { ClampedImage } from "./ClampedImage";
import "./index.css";

/*
The following features are enabled:
1) GFM (task lists, strikethrough, tables)
2) Auto-linking URLs
3) Auto-linking headers
4) Wikilinks ([[foo]])
5) @mentions
6) Embedded mermaid diagrams + whiteboards (tldraw)
7) Stripping frontmatter
8) Support for raw HTML (<ins>, <img>, <details> tags)
9) Footnotes ([^1])
10) "Alerts" (note/tip/warning/etc.)
11) Table of Contents (```toc```) + scroll to top
12) Emoji shortcodes (:emoji_id:)
13) Selection comments
*/

// Parse emoji data for use in emoji replacement
const emojis = Object.entries((emojiData as any).emojis).reduce(
  (acc, [id, emoji]) => {
    acc[id] = (emoji as any).skins[0]?.native || "";
    return acc;
  },
  {} as Record<string, string>
);

function createComponents(
  files: string[],
  onSelectFile: (file: string) => void,
  onSelectHeading?: (heading: string) => void,
  contentContainerRef?: React.RefObject<HTMLDivElement>,
  isReadonly = false,
  onToggleTaskListItem?: (text: string) => void,
  setOpenImageUrl?: React.Dispatch<React.SetStateAction<string | null>>,
  enableBlockquoteCopying = true,
  gists?: Gist[],
  onSelectGist?: (gistId: string) => void,
  setOpenMermaidSvg?: React.Dispatch<React.SetStateAction<string | null>>
) {
  let previousEquationResult: string | null = null;
  const namedEquationResults: Map<string, string> = new Map();

  const HiddenText = ({ text }: { text: string }) => {
    const [revealed, setRevealed] = useState(false);
    return (
      <span
        className={
          "cursor-pointer select-none text-primary transition-colors duration-200 " +
          (revealed
            ? "bg-transparent"
            : "bg-current border border-current rounded-sm")
        }
        onClick={() => setRevealed(true)}
      >
        {text}
      </span>
    );
  };

  const processHiddenText = (
    nodes: React.ReactNode[]
  ): React.ReactNode[] => {
    return nodes.flatMap((child, index) => {
      if (typeof child === "string") {
        const decoded = decodeHtmlEntities(child);
        const regex = />!([^<>]+)!</g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(decoded)) !== null) {
          if (match.index > lastIndex) {
            parts.push(decoded.slice(lastIndex, match.index));
          }
          parts.push(<HiddenText key={`${index}-${parts.length}`} text={match[1]} />);
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < decoded.length) {
          parts.push(decoded.slice(lastIndex));
        }
        return parts;
      }
      return child;
    });
  };

  const components = {
    pre({ children }) {
      const hasMermaidCode = Children.toArray(children).some(
        (child) =>
          typeof child === "object" &&
          child !== null &&
          "props" in child &&
          (child.props.className === "language-mermaid" ||
            child.props.className === "language-tldraw")
      );

      return hasMermaidCode ? (
        children
      ) : (
        <pre className="text-wrap">{children}</pre>
      );
    },
    img: ({ src, alt, ...props }) => (
      <ClampedImage
        src={src}
        alt={alt}
        {...props}
        onExpandImage={() => setOpenImageUrl(src)}
      />
    ),
    input({ type, ...props }) {
      if (type === "checkbox") {
        const { onChange, ...rest } = props as any;
        return <Checkbox {...rest} onCheckedChange={onChange as any} />;
      }
      return <input type={type} {...props} />;
    },
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const content = String(children).replace(/\n$/, "");

      if (!inline) {
        if (match?.[1] === "mermaid") {
          return (
            <Mermaid content={content} onExpandDiagram={setOpenMermaidSvg} />
          );
        }
        if (match?.[1] === "tldraw") {
          return <TLDraw isReadonly={isReadonly} />;
        }
        if (match?.[1] === "toc") {
          return (
            <TOC
              onSelectHeading={onSelectHeading}
              contentContainerRef={contentContainerRef}
            />
          );
        }
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    table({ children, className, ...props }) {
      return (
        <div className="overflow-x-auto w-full">
          <table className={className} {...props}>
            {children}
          </table>
        </div>
      );
    },
    p({ children, node, ...props }) {
      // TODO: De-dupe this with the code in the math equations extension for CodeMirror
      const processChildrenWithMath = (
        children: React.ReactNode[]
      ): React.ReactNode[] => {
        return children.map((child, index) => {
          if (typeof child === "string") {
            const assignments = extractVariableAssignments(child);
            if (assignments.size > 0) {
              for (const [name, value] of assignments.entries()) {
                namedEquationResults.set(name, value);
              }

              const nodes: React.ReactNode[] = [];
              const regex =
                /([^:]+):=\s*(\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[km]?)/gi;
              let lastIndex = 0;
              let match: RegExpExecArray | null;
              while ((match = regex.exec(child))) {
                if (match.index > lastIndex) {
                  nodes.push(child.slice(lastIndex, match.index));
                }

                const name = match[1].trim();
                const value = match[2].trim();
                nodes.push(
                  <span key={`assign-${index}-${nodes.length}`}>
                    <span className="font-bold text-blue-500">{name}: </span>
                    {value}
                  </span>
                );

                lastIndex = regex.lastIndex;
              }
              if (lastIndex < child.length) {
                nodes.push(child.slice(lastIndex));
              }

              return <React.Fragment key={index}>{nodes}</React.Fragment>;
            }

            const match = child.match(
              /^(?:([^:]+):\s*)?(.*?)([-+*/().\d\s,\$a-zA-Z_\-]+)=\s*$/
            );
            if (match) {
              const nameCapture = match[1];
              const beforeEq = match[2];
              const expr = match[3];

              const result = evaluateMathExpression(
                expr,
                previousEquationResult,
                namedEquationResults
              );

              if (result !== null) {
                const prevResult = previousEquationResult;

                if (nameCapture) {
                  const trimmedName = nameCapture.trim();
                  namedEquationResults.set(trimmedName, result);
                  namedEquationResults.set(
                    trimmedName.replace(/\s+/g, "-"),
                    result
                  );
                }

                const exprContent = () => {
                  const trimmed = match[3].trim();
                  if (prevResult === null || !trimmed.includes("_")) {
                    return trimmed;
                  }

                  const parts = trimmed.split("_");
                  const nodes: React.ReactNode[] = [];
                  parts.forEach((part, i) => {
                    if (i > 0) {
                      nodes.push(
                        <span
                          key={`prev-${index}-${i}`}
                          className="inline-block text-black rounded px-0.5 py-0 bg-green-500 select-none"
                        >
                          {prevResult}
                        </span>
                      );
                    }
                    if (part) nodes.push(part);
                  });
                  return nodes;
                };

                previousEquationResult = result;

                return (
                  <span key={index}>
                    {nameCapture && (
                      <span className="font-bold text-blue-500">
                        {nameCapture}:{" "}
                      </span>
                    )}
                    {beforeEq}
                    {exprContent()} =
                    <span className="inline-block text-black ml-1 rounded px-0.5 py-0 bg-amber-500 select-none">
                      {result}
                    </span>
                  </span>
                );
              }
            }
          }
          return child;
        });
      };

      const processedChildren = processHiddenText(
        processChildrenWithMath(Children.toArray(children))
      );

      return (
        <p {...props}>
          {processBookmarks(
            processWikilinks(
              processedChildren,
              files,
              onSelectFile,
              gists,
              onSelectGist
            ),
            onSelectHeading
          )}
        </p>
      );
    },
    li({ children, node, ...props }) {
      // Check if this is a task list item by examining the className
      if (props.className?.includes("task-list-item")) {
        props.onClick = () => {
          const itemText = (node as any).children[1]?.value?.trim() || "";
          onToggleTaskListItem?.(itemText);
        };
        // Find and modify the checkbox input if it exists
        children = Children.map(children, (child) => {
          if (typeof child === "object" && child !== null && "props" in child) {
            if (child.props?.type === "checkbox" || child.type === Checkbox) {
              // Create a new checkbox with the onChange handler
              return React.cloneElement(child, {
                disabled: isReadonly,
                // This isn't actually neccesary, but React will complain
                // if we don't add this, while setting the checked prop.
                onChange: undefined,
                onCheckedChange: props.onClick,
              });
            }
          }
          return child;
        });
      }

      // Regular list item handling
      return (
        <li {...props}>
          {processBookmarks(
            processWikilinks(
              Children.toArray(children),
              files,
              onSelectFile,
              gists,
              onSelectGist
            ),
            onSelectHeading
          )}
        </li>
      );
    },
    blockquote({ children, ...props }) {
      const [copied, setCopied] = useState(false);
      const ref = useRef<HTMLQuoteElement>(null);

      const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(ref.current?.innerText || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }, []);

      return (
        <blockquote
          {...props}
          ref={ref}
          className={cn("relative group", props.className)}
        >
          {enableBlockquoteCopying && (
            <button
              onClick={handleCopy}
              className="quote-copy-button absolute top-1 right-1 hidden group-hover:inline-flex items-center rounded bg-muted p-2 text-xs shadow"
              title="Copy quote"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 hover:text-green-500" />
              )}
            </button>
          )}
          {children}
        </blockquote>
      );
    },
    // Translate heading links into components that
    // can properly update the selected heading state
    a({ href, children, node, ...props }) {
      // Convert relative links (e.g. <a href="#foo">Click</a>) into a
      // a click gesture that properly scrolls/sets the selected heading.
      if (href?.startsWith("#") && onSelectHeading) {
        return (
          <a
            {...props}
            onClick={(e) => {
              e.preventDefault();
              onSelectHeading(href.slice(1));
            }}
            className="cursor-pointer"
          >
            {children}
          </a>
        );
      }

      // Make sure that external links open in a new tab
      return (
        <a {...props} href={href} target="_blank">
          {children}
        </a>
      );
    },
  } as const;

  if (onSelectHeading) {
    [1, 2, 3, 4, 5, 6].forEach((level) => {
      components[`h${level}`] = ({ children, id }) => {
        const [showCheck, setShowCheck] = useState(false);

        const handleClick = useCallback(
          (e: React.MouseEvent) => {
            e.preventDefault();
            onSelectHeading(id);
            setShowCheck(true);
            setTimeout(() => setShowCheck(false), 3000);
          },
          [id]
        );

        return createElement(
          `h${level}`,
          {
            id,
            className: "flex items-center gap-3 group cursor-pointer",
            onClick: handleClick,
          },
          children,
          <a
            title="Link to heading"
            className={cn(showCheck ? "inline" : "hidden group-hover:inline")}
          >
            {showCheck ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Link className="h-5 w-5" />
            )}
          </a>
        );
      };
    });
  }

  return components;
}

function processEmojis(text: string) {
  return text.replace(/(?<=^|[\s([]):([a-zA-Z0-9_+-]+):/g, (match, emojiId) => {
    return emojis[emojiId] || match;
  });
}

function processMentions(text: string) {
  return text.replace(
    /\B(@[a-zA-Z0-9-]+)\b/g,
    (match, username) =>
      `[**${match}**](https://github.com/${username.slice(1)})`
  );
}

interface MarkdownProps {
  children: string; // The markdown content to be rendered

  onSelectFile?: (file: string) => void;
  onSelectHeading?: (heading: string) => void;

  parseMentions?: boolean;
  parseEmojis?: boolean;

  contentContainerRef?: React.RefObject<HTMLDivElement>;
  isReadonly?: boolean;
  scrollPastTheEnd?: boolean;

  showInlineComments?: boolean;
  comments?: GistComment[];
  onAddComment?: (selectedText: string) => void;
  setSelectedComment?: (commentId: number) => void;
  selectedCommentId?: number | null;
  onToggleTaskListItem?: (text: string) => void;

  shouldInvert?: boolean;
  enableBlockquoteCopying?: boolean;

  gists?: Gist[];
  onSelectGist?: (gistId: string) => void;
}

function MarkdownInternal({
  children,
  onSelectFile,
  onSelectHeading,
  parseMentions = true,
  parseEmojis = true,
  contentContainerRef,
  isReadonly = false,
  onAddComment,
  scrollPastTheEnd = false,
  showInlineComments = true,
  comments = [],
  setSelectedComment,
  selectedCommentId = null,
  onToggleTaskListItem,
  shouldInvert = true,
  enableBlockquoteCopying = true,
  gists,
  onSelectGist,
}: MarkdownProps) {
  const files = useAtomValue(selectedGistFilesAtom);
  resetBookmarkCounter();
  const [openImageUrl, setOpenImageUrl] = useState<string | null>(null);
  const [openMermaidSvg, setOpenMermaidSvg] = useState<string | null>(null);
  // TODO: Re-evaluate how we handle selection comments, since this code
  // seems kind of nasty. It's this way because we wanted to support showing
  // hiding the comment button on selection change, without triggering a re-render.
  const markdownContainerRef = useRef<HTMLDivElement>(null);
  const commentButtonRef = useRef<HTMLButtonElement | null>(null);
  const commentButtonVisible = useRef<boolean>(false);
  const selectionTimeoutRef = useRef<number | null>(null);
  const THROTTLE_DELAY = 300;

  // DOM-based implementation for adding comment button
  const createCommentButton = useCallback(() => {
    if (commentButtonRef.current) return;

    const button = document.createElement("button");
    button.className =
      "md-selection-comment-button fixed z-50 p-1 bg-primary text-primary-foreground rounded-md shadow-md hover:bg-primary/90 transition-colors";
    button.title = "Add comment with selected text";
    button.style.display = "none";

    // Add button icon (message square)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
    );

    svg.appendChild(path);
    button.appendChild(svg);

    document.body.appendChild(button);
    commentButtonRef.current = button;
  }, []);

  // Show comment button at position
  const showCommentButton = useCallback((selection: Selection) => {
    if (!commentButtonRef.current) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position relative to viewport, not container
    commentButtonRef.current.style.top = `${rect.top - 30}px`;
    commentButtonRef.current.style.left = `${rect.left}px`;
    commentButtonRef.current.style.display = "block";

    commentButtonVisible.current = true;
  }, []);

  const hideCommentButton = useCallback(() => {
    if (commentButtonRef.current) {
      commentButtonRef.current.style.display = "none";
      commentButtonVisible.current = false;
    }
  }, []);

  // Handle text selection in the markdown content
  const handleTextSelection = useCallback(
    () => {
      if (selectionTimeoutRef.current) {
        window.clearTimeout(selectionTimeoutRef.current);
        selectionTimeoutRef.current = null;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideCommentButton();
        return;
      }

      const text = selection.toString();
      if (text.trim().length < 4) {
        hideCommentButton();
        return;
      }

      // Don't show button if selection is not within our container
      const container = markdownContainerRef.current;
      let isSelectionInsideContainer = false;
      const range = selection.getRangeAt(0);

      // Check if the selection is inside our container
      if (container.contains(range.commonAncestorContainer)) {
        isSelectionInsideContainer = true;
      }

      if (!isSelectionInsideContainer) {
        hideCommentButton();
        return;
      }

      // Set button click handler to add comment with selected text
      if (commentButtonRef.current) {
        // Remove old event listeners to prevent duplicates
        const newButton = commentButtonRef.current.cloneNode(true);
        if (commentButtonRef.current.parentNode) {
          commentButtonRef.current.parentNode.replaceChild(
            newButton,
            commentButtonRef.current
          );
        }
        commentButtonRef.current = newButton as HTMLButtonElement;

        commentButtonRef.current.addEventListener("click", (evt) => {
          evt.preventDefault();
          evt.stopPropagation();

          onAddComment(text);
          hideCommentButton();
        });
      }

      // Throttle updates with a delay to give browser time to paint selection
      selectionTimeoutRef.current = window.setTimeout(() => {
        if (selection && !selection.isCollapsed) {
          showCommentButton(selection);
        }
      }, THROTTLE_DELAY);
    },
    [onAddComment, showCommentButton, hideCommentButton]
  );

  // Process comment quotes and apply annotations to the rendered markdown
  const processCommentQuotes = useCallback(() => {
    if (!markdownContainerRef.current || comments.length === 0) return;

    // Get comments that start with quotes (>)
    const commentsWithQuotes = comments.filter((comment) => {
      const firstLine = comment.body.split("\n")[0];
      return firstLine.trim().startsWith(">");
    });

    if (commentsWithQuotes.length === 0) return;

    // For each comment with a quote, find the quoted text in the rendered markdown
    commentsWithQuotes.forEach((comment) => {
      const firstLine = comment.body.split("\n")[0];
      // Extract text after the '>' character and trim it
      const quotedText = firstLine.trim().substring(1).trim();

      if (quotedText.length < 3) return; // Skip very short quotes

      // Use a text finder to locate the quoted text within the container
      const walker = document.createTreeWalker(
        markdownContainerRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );

      const matches: Array<{
        node: Text;
        startOffset: number;
        endOffset: number;
      }> = [];

      let selectedComment = null;

      // Find all text node matches
      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        const textContent = textNode.textContent || "";

        // Escape special regex characters in quotedText
        const escapedQuotedText = quotedText.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        // Create a regex with word boundaries
        const regex = new RegExp(`\\b${escapedQuotedText}\\b`, "g");
        let match: RegExpExecArray | null;

        while ((match = regex.exec(textContent)) !== null) {
          matches.push({
            node: textNode,
            startOffset: match.index,
            endOffset: match.index + quotedText.length,
          });
        }
      }

      // Only annotate if we found exactly one match (to avoid incorrect annotations)
      if (matches.length === 1) {
        const match = matches[0];
        const range = document.createRange();
        range.setStart(match.node, match.startOffset);
        range.setEnd(match.node, match.endOffset);

        const wrapper = document.createElement("div");
        wrapper.className = "tooltip-wrapper";

        // Create the tooltip content
        const tooltipContent = document.createElement("div");
        tooltipContent.className = "md-comment-tooltip";

        const adjustTooltipPosition = () => {
          const tooltipHeight = tooltipContent.offsetHeight;
          const wrapperRect = wrapper.getBoundingClientRect();
          if (wrapperRect.top < tooltipHeight + 8) {
            tooltipContent.classList.add("below");
          } else {
            tooltipContent.classList.remove("below");
          }
        };

        wrapper.addEventListener("mouseenter", adjustTooltipPosition);

        // Get comment body without the blockquote
        const commentLines = comment.body.split("\n");
        const bodyWithoutQuote = commentLines
          .slice(1) // Skip the first line which contains the blockquote
          .join("\n")
          .trim();

        // Create and render the tooltip content
        const root = createRoot(tooltipContent);
        root.render(
          <>
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={comment.user?.avatar_url} />
                <AvatarFallback>
                  {comment.user?.login[0].toUpperCase() ?? "A"}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm font-bold">
                {comment.user?.login || "Anonymous"}
              </div>
            </div>
            <div className="mt-1">
              <MarkdownPreview>{bodyWithoutQuote}</MarkdownPreview>
            </div>
          </>
        );

        // Create the highlighted text span
        const highlightSpan = document.createElement("span");
        highlightSpan.className = `md-comment-quote${selectedCommentId === comment.id ? " selected" : ""}`;
        highlightSpan.textContent = quotedText;
        highlightSpan.onclick = () => setSelectedComment(comment.id);

        if (selectedCommentId === comment.id) {
          selectedComment = highlightSpan;
        }

        // Add the elements to the wrapper
        wrapper.appendChild(highlightSpan);
        wrapper.appendChild(tooltipContent);

        // Replace the original text with our wrapper
        range.deleteContents();
        range.insertNode(wrapper);
      }

      if (selectedComment) {
        selectedComment.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    });
  }, [comments, selectedCommentId]);

  useEffect(() => {
    const container = markdownContainerRef.current;
    if (!container || !onAddComment) return;

    createCommentButton();

    // Listen for selection changes
    container.addEventListener("mouseup", handleTextSelection);

    // Close button when clicking elsewhere
    const handleDocumentClick = (e: MouseEvent) => {
      // Don't clear if clicking on the button itself
      if (
        commentButtonRef.current &&
        (commentButtonRef.current === e.target ||
          commentButtonRef.current.contains(e.target as Node))
      ) {
        return;
      }

      hideCommentButton();
    };

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      container.removeEventListener("mouseup", handleTextSelection);
      document.removeEventListener("mousedown", handleDocumentClick);

      if (selectionTimeoutRef.current) {
        window.clearTimeout(selectionTimeoutRef.current);
      }

      if (commentButtonRef.current) {
        document.body.removeChild(commentButtonRef.current);
        commentButtonRef.current = null;
      }
    };
  }, [handleTextSelection, hideCommentButton, onAddComment]);

  // Process comment quotes after render
  useEffect(() => {
    if (showInlineComments) {
      const timer = setTimeout(processCommentQuotes, 100);
      return () => clearTimeout(timer);
    }
  }, [processCommentQuotes, children, showInlineComments, selectedCommentId]);

  // Process the markdown content
  let processedChildren = children;

  if (parseEmojis) {
    processedChildren = processEmojis(processedChildren);
  }

  if (parseMentions) {
    processedChildren = processMentions(processedChildren);
  }

  return (
    // TODO: Clean up this prose classname mess
    <div
      className={`prose prose-sm ${shouldInvert ? " dark:prose-invert" : " prose-invert dark:prose dark:prose-sm"} max-w-none break-words markdown-container relative min-w-0${scrollPastTheEnd ? " pb-[100px]" : ""}`}
      ref={markdownContainerRef}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkGithubAlerts, remarkFrontmatter]}
        rehypePlugins={[rehypeSlug, rehypeRaw]}
        components={createComponents(
          files,
          onSelectFile,
          onSelectHeading,
          contentContainerRef,
          isReadonly,
          onToggleTaskListItem,
          setOpenImageUrl,
          enableBlockquoteCopying,
          gists,
          onSelectGist,
          setOpenMermaidSvg
        )}
      >
        {processedChildren}
      </ReactMarkdown>

      <ImageDialog
        imageUrl={openImageUrl}
        onClose={() => setOpenImageUrl(null)}
      />

      <Dialog
        open={openMermaidSvg !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenMermaidSvg(null);
          }
        }}
      >
        <DialogContent
          className="p-4 cursor-pointer w-[75vw] flex items-center justify-center"
          onClick={() => setOpenMermaidSvg(null)}
          dangerouslySetInnerHTML={{ __html: openMermaidSvg }}
        />
      </Dialog>

    </div>
  );
}

export const MarkdownPreview = memo(MarkdownInternal, (prev, next) => {
  // If the content, comments, or selected comment hasn't changed, then
  // don't re-render the component.
  return (
    prev.children === next.children &&
    prev.comments === next.comments &&
    prev.showInlineComments === next.showInlineComments &&
    prev.selectedCommentId === next.selectedCommentId &&
    prev.shouldInvert === next.shouldInvert
  );
});
