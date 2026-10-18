import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useEffectEvent, type RefObject } from "react";

/** A heading in a document's outline (e.g. for a table of contents). */
export interface Heading {
  id: string;
  text: string;
  level: number;
}

/** Whether a heading is part of the document's outline (unlike the heading that footnotes are rendered with). */
export const isOutlineHeading = (id: unknown): id is string =>
  typeof id === "string" && id !== "" && id !== "footnote-label";

/** The headings in a rendered document. */
export function readHeadings(container: HTMLElement | null): Heading[] {
  return [...(container?.querySelectorAll("h1, h2, h3, h4, h5, h6") ?? [])]
    .filter(({ id }) => isOutlineHeading(id))
    .map((heading) => ({
      id: heading.id,
      text: heading.textContent?.trim() ?? "",
      level: Number(heading.tagName[1]),
    }));
}

/** Scrolls to a heading in a rendered document (and focuses it, for keyboard users). */
function scrollToHeading(container: HTMLElement | null, id: string) {
  const heading = container?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
  if (!heading) return;

  heading.scrollIntoView();
  heading.setAttribute("tabindex", "-1");
  heading.focus();
}

/**
 * The heading that the URL links to (`?heading=`), in a rendered document. Opening a link scrolls to
 * its heading (once the document has rendered), and selecting a heading links to it (and copies the link).
 */
export function useLinkedHeading(
  container: RefObject<HTMLElement | null>,
  file: { key: string; isLoading: boolean },
) {
  const { heading } = useSearch({ strict: false });
  const navigate = useNavigate();

  const scrollToLinkedHeading = useEffectEvent(() => {
    if (heading) scrollToHeading(container.current, heading);
  });
  useEffect(() => {
    if (!file.isLoading) scrollToLinkedHeading();
  }, [file.key, file.isLoading]);

  const selectHeading = async (id: string) => {
    await navigate({ to: ".", search: (search) => ({ ...search, heading: id }), replace: true });
    scrollToHeading(container.current, id);
    await navigator.clipboard.writeText(location.href);
  };

  return [heading, selectHeading] as const;
}
