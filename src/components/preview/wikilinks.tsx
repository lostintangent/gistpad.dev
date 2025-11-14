import { Gist, getGistDisplayName } from "@/lib/github";
import { Children, ReactNode } from "react";

export function processWikilinks(
    children: ReactNode[],
    files: string[],
    onSelectFile: (file: string) => void,
    gists?: Gist[],
    onSelectGist?: (gistId: string) => void
) {
    const segments: React.ReactNode[] = [];
    let currentText = "";

    // Helper to push accumulated text
    const pushText = () => {
        if (currentText) {
            segments.push(currentText);
            currentText = "";
        }
    };

    // Process each child
    Children.toArray(children).forEach((child) => {
        if (typeof child === "string") {
            const text = child;
            let lastIndex = 0;
            const wikilinkRegex = /(?<!!)\[\[([^\]]+)\]\]/g;
            let match;

            while ((match = wikilinkRegex.exec(text)) !== null) {
                // Add text before the match
                currentText += text.slice(lastIndex, match.index);
                pushText();

                const [fullMatch, linkText] = match;

                // Check if linkText is a GUID (like 5b5e8cfa1a3d3d3b4349ab75991c870a)
                const guidRegex = /^[a-f0-9]{32}$/;
                const isGuid = guidRegex.test(linkText);

                if (isGuid && gists && onSelectGist) {
                    const matchingGist = gists.find(g => g.id === linkText);
                    if (matchingGist) {
                        segments.push(
                            <button
                                key={`gist-${segments.length}`}
                                onClick={() => onSelectGist(linkText)}
                                className="px-1 text-blue-100 bg-blue-700 rounded hover:bg-blue-500"
                            >
                                {getGistDisplayName(matchingGist)}
                            </button>
                        );
                    } else {
                        // GUID not found in gists list
                        segments.push(
                            <span
                                key={`link-${segments.length}`}
                                className="text-muted-foreground"
                            >
                                {linkText}
                            </span>
                        );
                    }
                } else {
                    // Regular file link
                    const targetFile = `${linkText}.md`;
                    if (files.includes(targetFile)) {
                        segments.push(
                            <button
                                key={`link-${segments.length}`}
                                onClick={() => onSelectFile?.(targetFile)}
                                className="cm-wikilink-content"
                            >
                                {linkText}
                            </button>
                        );
                    } else {
                        segments.push(
                            <span
                                key={`link-${segments.length}`}
                                className="text-muted-foreground"
                            >
                                {linkText}
                            </span>
                        );
                    }
                }

                lastIndex = match.index + fullMatch.length;
            }

            // Add remaining text
            currentText += text.slice(lastIndex);
        } else {
            pushText();
            segments.push(child);
        }
    });

    pushText();
    return segments;
};
