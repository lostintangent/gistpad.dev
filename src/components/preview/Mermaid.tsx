import mermaid from "mermaid";
import { useEffect, useState } from "react";

export default function Mermaid({ content, onExpandDiagram }: { content: string; onExpandDiagram?: (svg: string) => void }) {
    const [svg, setSvg] = useState<string>("");

    useEffect(() => {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({
            startOnLoad: true,
            theme: isDark ? "dark" : "default",
            securityLevel: "loose",
        });
    }, []);

    useEffect(() => {
        const renderDiagram = async () => {
            const id = `mermaid-${crypto.randomUUID()}`;
            try {
                // We want to purposely throw on invalid syntax, so we can catch it
                await mermaid.parse(content);
                const { svg } = await mermaid.render(id, content);
                setSvg(svg);
            } catch {
                setSvg(
                    `<pre style="color:red">Mermaid syntax error 🤔 Check your diagram!</pre>`
                );
            }
        };

        renderDiagram();
    }, [content]);

    return (
        <div
            className="cursor-pointer hover:opacity-90 transition-opacity"
            dangerouslySetInnerHTML={{ __html: svg }}
            onClick={() => onExpandDiagram?.(svg)}
        />
    );
}
