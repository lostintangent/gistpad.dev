import { Bookmark } from "lucide-react";
import { Children, ReactNode } from "react";

let bookmarkCounter = 1;

export function resetBookmarkCounter() {
  bookmarkCounter = 1;
}

export function processBookmarks(
  children: ReactNode[],
  onSelectHeading?: (heading: string) => void
) {
  const segments: React.ReactNode[] = [];
  let currentText = "";

  const pushText = () => {
    if (currentText) {
      segments.push(currentText);
      currentText = "";
    }
  };

  Children.toArray(children).forEach((child) => {
    if (typeof child === "string") {
      const text = child;
      let lastIndex = 0;
      const regex = /\{#([a-zA-Z0-9_-]*)\}/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        currentText += text.slice(lastIndex, match.index);
        pushText();

        const id = match[1] || `bookmark-${bookmarkCounter++}`;
        segments.push(
          <a
            key={`bookmark-${segments.length}`}
            id={id}
            className="no-underline cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              onSelectHeading?.(id);
            }}
          >
            <Bookmark className="h-4 w-4 inline-block text-blue-500 fill-blue-500" />
          </a>
        );

        lastIndex = match.index + match[0].length;
      }
      currentText += text.slice(lastIndex);
    } else {
      pushText();
      segments.push(child);
    }
  });

  pushText();
  return segments;
}
