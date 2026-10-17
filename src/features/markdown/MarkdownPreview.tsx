import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { getHighlightClasses, type QuotedCommentThread } from "@/features/comments/threads";
import { emojisQuery, type Emoji } from "@/shared/emojis";
import { getGistDisplayName, type Gist } from "@/shared/github";
import { useTransientState } from "@/shared/useTransientState";
import { cn } from "cn";
import { Bookmark, Check, Copy, Link } from "lucide-react";
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown, { type Components, type ExtraProps, type Options } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkGithubAlerts from "remark-github-alerts";
import Mermaid from "./Mermaid";
import rehypeCommentHighlights from "./rehypeCommentHighlights";
import rehypeToc from "./rehypeToc";
import remarkInlineSyntax from "./remarkInlineSyntax";
import { SelectionCommentButton } from "./SelectionCommentButton";
import { TLDraw } from "./TLDraw";

/*
Renders GitHub-flavored markdown, with GistPad's extensions:
1) Wikilinks ([[foo]]) and gist citations ([[gistId]])
2) @mentions and emoji shortcodes (:emoji_id:)
3) Embedded mermaid diagrams, whiteboards (tldraw) and tables of contents (toc)
4) Bookmarks ({#}), spoilers (>!text!<) and calculations (`total: 5 * 3 =`)
5) Alerts, footnotes, raw HTML (e.g. <ins>, <img>, <details>) and task lists
6) Comments on (and highlights of) selected text
*/

interface MarkdownOptions {
  /** The files in the current gist, which wikilinks can link to. */
  files?: string[];
  onOpenFile?: (filename: string) => void;
  /** Gists that can be cited (e.g. by AI answers), using `[[gistId]]`. */
  gists?: Gist[];
  onOpenGist?: (gistId: string) => void;
  onSelectHeading?: (id: string) => void;
  /** Toggles a task list item, which is identified by its text. */
  onToggleTask?: (text: string) => void;
  isReadOnly?: boolean;
  enableBlockquoteCopying?: boolean;
  /** The comment whose quote is highlighted as selected. */
  selectedCommentId?: number | null;
  /** Expands an image or diagram into a dialog. */
  onExpand: (media: ExpandedMedia) => void;
}

type ExpandedMedia = { type: "image"; url: string } | { type: "diagram"; svg: string };

const MarkdownContext = createContext<MarkdownOptions>({ onExpand: () => {} });

/** The props that react-markdown passes to components (which include the hast node). */
type ElementProps<Tag extends keyof React.JSX.IntrinsicElements> = ComponentProps<Tag> & ExtraProps;

// Components

const GIST_ID = /^[a-f0-9]{32}$/;

function Anchor({ href, children, node: _, ...props }: ElementProps<"a">) {
  const { files = [], onOpenFile, gists = [], onOpenGist, onSelectHeading } = use(MarkdownContext);
  const { "data-wikilink": wikilink, "data-bookmark": bookmark } = props as Record<
    string,
    string | undefined
  >;

  if (bookmark !== undefined) {
    return (
      <a
        id={bookmark}
        className="no-underline cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onSelectHeading?.(bookmark);
        }}
      >
        <Bookmark className="h-4 w-4 inline-block text-blue-500 fill-blue-500" />
      </a>
    );
  }

  if (wikilink !== undefined) {
    const gist = GIST_ID.test(wikilink) ? gists.find(({ id }) => id === wikilink) : undefined;
    if (gist && onOpenGist) {
      return (
        <button
          onClick={() => onOpenGist(gist.id)}
          className="px-1 text-blue-100 bg-blue-700 rounded hover:bg-blue-500"
        >
          {getGistDisplayName(gist)}
        </button>
      );
    }

    const filename = `${wikilink}.md`;
    return files.includes(filename) && onOpenFile ? (
      <button onClick={() => onOpenFile(filename)} className="cm-wikilink-content">
        {wikilink}
      </button>
    ) : (
      <span className="text-muted-foreground">{wikilink}</span>
    );
  }

  // Links to headings scroll to (and select) the heading
  if (href?.startsWith("#") && onSelectHeading) {
    return (
      <a
        {...props}
        className="cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onSelectHeading(href.slice(1));
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <a {...props} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function Spoiler({ children }: { children: ReactNode }) {
  const [isRevealed, setIsRevealed] = useState(false);
  return (
    <span
      className={cn(
        "cursor-pointer select-none text-primary transition-colors duration-200",
        isRevealed ? "bg-transparent" : "bg-current border border-current rounded-sm",
      )}
      onClick={() => setIsRevealed(true)}
    >
      {children}
    </span>
  );
}

function Span({ node: _, ...props }: ElementProps<"span">) {
  if ("data-spoiler" in props) return <Spoiler>{props.children}</Spoiler>;
  if ("data-comment-id" in props) {
    return (
      <CommentHighlight commentId={Number(props["data-comment-id"])}>
        {props.children}
      </CommentHighlight>
    );
  }
  return <span {...props} />;
}

/** Text that a comment quotes (see `rehypeCommentHighlights`), which is scrolled to when selected. */
function CommentHighlight({ commentId, children }: { commentId: number; children?: ReactNode }) {
  const { selectedCommentId } = use(MarkdownContext);
  const isSelected = commentId === selectedCommentId;
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isSelected]);

  return (
    <span ref={ref} className={getHighlightClasses(isSelected)} data-comment-id={commentId}>
      {children}
    </span>
  );
}

function Heading({ node, id, children }: ElementProps<"h1">) {
  const { onSelectHeading } = use(MarkdownContext);
  const [isLinkCopied, setIsLinkCopied] = useTransientState(false);
  const Tag = node!.tagName as "h1";

  if (!onSelectHeading || !id) return <Tag id={id}>{children}</Tag>;

  return (
    <Tag
      id={id}
      className="flex items-center gap-3 group cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        onSelectHeading(id);
        setIsLinkCopied(true);
      }}
    >
      {children}
      <a title="Link to heading" className={isLinkCopied ? "inline" : "hidden group-hover:inline"}>
        {isLinkCopied ? <Check className="h-5 w-5 text-green-500" /> : <Link className="h-5 w-5" />}
      </a>
    </Tag>
  );
}

function Blockquote({ children, node: _, className, ...props }: ElementProps<"blockquote">) {
  const { enableBlockquoteCopying = true } = use(MarkdownContext);
  const [isCopied, setIsCopied] = useTransientState(false);

  return (
    <blockquote {...props} className={cn("relative group", className)}>
      {enableBlockquoteCopying && (
        <button
          onClick={(e) => {
            navigator.clipboard.writeText(e.currentTarget.parentElement!.innerText);
            setIsCopied(true);
          }}
          className="absolute top-1 right-1 hidden group-hover:inline-flex items-center rounded bg-muted p-2 text-xs shadow"
          title="Copy quote"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 hover:text-green-500" />
          )}
        </button>
      )}
      {children}
    </blockquote>
  );
}

function ListItem({ node, ...props }: ElementProps<"li">) {
  const { onToggleTask, isReadOnly } = use(MarkdownContext);
  const isTask = props.className?.includes("task-list-item");
  if (!isTask || !onToggleTask || isReadOnly) return <li {...props} />;

  // Tasks are identified by their text (which follows their checkbox, in one or more text nodes)
  const text = node?.children.map((child) => (child.type === "text" ? child.value : "")).join("");
  return <li {...props} onClick={() => onToggleTask(text?.trim() ?? "")} />;
}

function Input({ type, checked, node: _, ...props }: ElementProps<"input">) {
  const { onToggleTask, isReadOnly } = use(MarkdownContext);

  // Task checkboxes are toggled by clicking their list item
  return type === "checkbox" ? (
    <Checkbox checked={!!checked} disabled={!onToggleTask || isReadOnly} />
  ) : (
    <input type={type} checked={checked} {...props} />
  );
}

function Image({ src, alt, node: _, ...props }: ElementProps<"img">) {
  const { onExpand } = use(MarkdownContext);
  const [isTall, setIsTall] = useState(false);
  if (typeof src !== "string" || !src) return null;

  return (
    <span
      className="block relative max-h-[500px] overflow-hidden group cursor-pointer"
      onClick={() => onExpand({ type: "image", url: src })}
    >
      <img
        src={src}
        alt={alt}
        {...props}
        onLoad={(e) => setIsTall(e.currentTarget.offsetHeight > 500)}
      />
      {isTall && (
        <>
          <span className="absolute left-0 bottom-0 w-full h-8 bg-linear-to-t from-background to-transparent pointer-events-none" />
          <span className="absolute left-2 bottom-2 bg-background text-foreground px-3 py-1.5 rounded-full shadow-lg border border-muted text-xs font-medium">
            View full image
          </span>
        </>
      )}
    </span>
  );
}

const EMBED_LANGUAGES = ["language-mermaid", "language-tldraw"];

function Pre({ children, node, ...props }: ElementProps<"pre">) {
  // Embedded content (e.g. diagrams) renders its own container
  const isEmbed = node?.children.some(
    (child) =>
      child.type === "element" && EMBED_LANGUAGES.includes(String(child.properties.className)),
  );

  return isEmbed ? (
    children
  ) : (
    <pre {...props} className="text-wrap">
      {children}
    </pre>
  );
}

function Code({ className, children, node: _, ...props }: ElementProps<"code">) {
  const { onExpand, isReadOnly } = use(MarkdownContext);
  const language = className?.match(/language-(\w+)/)?.[1];

  switch (language) {
    case "mermaid":
      return (
        <Mermaid
          content={String(children).trim()}
          onExpand={(svg) => onExpand({ type: "diagram", svg })}
        />
      );
    case "tldraw":
      return <TLDraw isReadOnly={isReadOnly} />;
    default:
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
  }
}

function Table({ node: _, ...props }: ElementProps<"table">) {
  return (
    <div className="overflow-x-auto w-full">
      <table {...props} />
    </div>
  );
}

const components: Components = {
  a: Anchor,
  span: Span,
  blockquote: Blockquote,
  li: ListItem,
  input: Input,
  img: Image,
  pre: Pre,
  code: Code,
  table: Table,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
};

// Preview

const HTML_TAG = /<[a-z!/]/i;

const toEmojiMap = (emojis: Emoji[]) => new Map(emojis.map((emoji) => [emoji.id, emoji.native]));

interface MarkdownPreviewProps extends Omit<MarkdownOptions, "onExpand"> {
  children: string;
  /** Adds space at the end of the document, so the action bar doesn't cover it. */
  scrollPastEnd?: boolean;
  /** Whether to invert the colors in dark mode (which isn't needed on an inverted background). */
  shouldInvert?: boolean;
  /** Allows commenting on selected text. */
  onAddComment?: (selectedText: string) => void;
  /** Highlights the text that comments quote (whose hovers and clicks are handled by `CommentTooltips`). */
  comments?: { threads: QuotedCommentThread[]; selectedId?: number | null };
}

export function MarkdownPreview({
  children,
  scrollPastEnd = false,
  shouldInvert = true,
  onAddComment,
  comments,
  ...options
}: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandDialog] = useState(() => DialogPrimitive.createHandle<ExpandedMedia>());

  // Emojis by their shortcode (e.g. `tada`), once the emoji data has loaded
  const { data: emojis } = useQuery({ ...emojisQuery, select: toEmojiMap });
  const remarkPlugins: Options["remarkPlugins"] = [
    remarkGfm,
    remarkGithubAlerts,
    remarkFrontmatter,
    [remarkInlineSyntax, { emojis }],
  ];

  // The plugin for rendering HTML in markdown is large (since it includes an HTML parser), and so
  // it's only loaded for documents that appear to contain HTML.
  const hasHtml = HTML_TAG.test(children);
  const { data: rehypeRaw } = useQuery({
    queryKey: ["rehype-raw"],
    queryFn: async () => (await import("rehype-raw")).default,
    staleTime: "static",
    gcTime: Infinity,
    meta: { persist: false },
    enabled: hasHtml,
  });

  // Raw HTML is parsed first, so that its headings get IDs (and are included in tables of contents).
  const rehypePlugins: NonNullable<Options["rehypePlugins"]> = [rehypeSlug, rehypeToc];
  if (rehypeRaw) rehypePlugins.unshift(rehypeRaw);
  if (comments) rehypePlugins.push([rehypeCommentHighlights, { threads: comments.threads }]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "prose prose-sm prose-neutral max-w-none break-words markdown-container relative min-w-0",
        shouldInvert ? "dark:prose-invert" : "prose-invert dark:prose dark:prose-sm",
        scrollPastEnd && "pb-[100px]",
      )}
    >
      <MarkdownContext
        value={{
          ...options,
          selectedCommentId: comments?.selectedId,
          onExpand: (media) => expandDialog.openWithPayload(media),
        }}
      >
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
          // (Rather than showing the HTML as text, while its plugin is loading)
          skipHtml={hasHtml && !rehypeRaw}
        >
          {children}
        </ReactMarkdown>
      </MarkdownContext>

      {onAddComment && (
        <SelectionCommentButton containerRef={containerRef} onComment={onAddComment} />
      )}

      <Dialog handle={expandDialog}>
        {({ payload: media }) =>
          media && (
            <DialogContent
              showCloseButton={false}
              className={cn(
                "cursor-pointer flex items-center justify-center",
                media.type === "image"
                  ? "p-0 border-none bg-transparent"
                  : "p-4 w-[75vw] sm:max-w-[75vw]",
              )}
              onClick={() => expandDialog.close()}
            >
              {media.type === "image" ? (
                <img
                  src={media.url}
                  className="max-h-[95vh] max-w-[95vw] object-contain"
                  alt="Expanded view"
                />
              ) : (
                <div className="contents" dangerouslySetInnerHTML={{ __html: media.svg }} />
              )}
            </DialogContent>
          )
        }
      </Dialog>
    </div>
  );
}
