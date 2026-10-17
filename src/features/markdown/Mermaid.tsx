import { useIsDarkMode } from "@/shared/useMediaQuery";
import { useQuery } from "@tanstack/react-query";

/** Renders a diagram to SVG, loading Mermaid (which is large) the first time it's needed. */
async function renderDiagram(content: string, isDarkMode: boolean) {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    theme: isDarkMode ? "dark" : "default",
    // Diagrams can come from other people's gists, so don't allow scripts or HTML in them.
    securityLevel: "strict",
  });

  try {
    // Parse first, so that syntax errors are thrown (instead of rendered as an error diagram)
    await mermaid.parse(content);
    const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, content);
    return svg;
  } catch {
    return `<pre style="color:red">Mermaid syntax error 🤔 Check your diagram!</pre>`;
  }
}

export default function Mermaid({
  content,
  onExpand,
}: {
  content: string;
  onExpand: (svg: string) => void;
}) {
  const isDarkMode = useIsDarkMode();

  // Rendered diagrams are cached, so they don't flicker while the document is being edited.
  const { data: svg } = useQuery({
    queryKey: ["mermaid", content, isDarkMode],
    queryFn: () => renderDiagram(content, isDarkMode),
    staleTime: Infinity,
    // (Each edit to a diagram renders a new one, so don't keep old ones around for long)
    gcTime: 1000 * 60 * 5,
    placeholderData: (previousSvg) => previousSvg,
    meta: { persist: false },
  });

  return (
    <div
      className="cursor-pointer hover:opacity-90 transition-opacity"
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
      onClick={() => svg && onExpand(svg)}
    />
  );
}
