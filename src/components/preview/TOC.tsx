import { useEffect, useState } from "react";

interface TOCProps {
  onSelectHeading: (heading: string) => void;
  contentContainerRef: React.RefObject<HTMLDivElement>;
}

// TODO: There's a potential memory leak here if the contentContainerRef changes frequently.
// We should consider using a cleanup function to clear the cache for that ref.
const headingsCache = new Map<React.RefObject<HTMLDivElement>, { id: string; text: string; level: number }[]>();

export function TOC({ onSelectHeading, contentContainerRef }: TOCProps) {
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>(() => headingsCache.get(contentContainerRef) || []);

  useEffect(() => {
    // If we don't have a contentContainerRef or it doesn't have a current value, return
    if (!contentContainerRef || !contentContainerRef.current) return;

    // Find all headings within the content container
    const headingElements = contentContainerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');

    const extractedHeadings = Array.from(headingElements).map((heading) => {
      const id = heading.id;
      const text =
        heading.textContent?.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '') || '';
      const level = parseInt(heading.tagName.slice(1));

      return { id, text, level };
    });

    const sanitizedHeadings =
      extractedHeadings.length > 0 &&
        extractedHeadings[extractedHeadings.length - 1].text.trim().toLowerCase() ===
        'footnotes'
        ? extractedHeadings.slice(0, -1)
        : extractedHeadings;

    headingsCache.set(contentContainerRef, sanitizedHeadings);
    setHeadings(sanitizedHeadings);
  }, [contentContainerRef]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="markdown-toc">
      <ul className="list-none pl-0">
        {headings.map((heading, index) => (
          <li
            key={index}
            className="pl-4"
            style={{ marginLeft: `${(heading.level - 1) * 1}rem` }}
          >
            <a
              onClick={(e) => {
                e.preventDefault();
                if (onSelectHeading) {
                  onSelectHeading(heading.id);
                }
              }}
              className="hover:underline cursor-pointer"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}