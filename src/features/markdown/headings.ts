export interface Heading {
  id: string;
  text: string;
  level: number;
}

/** The headings in a rendered document (excluding its footnotes heading). */
export function readHeadings(container: HTMLElement | null): Heading[] {
  return [...(container?.querySelectorAll("h1, h2, h3, h4, h5, h6") ?? [])]
    .filter(({ id }) => id && id !== "footnote-label")
    .map((heading) => ({
      id: heading.id,
      text: heading.textContent?.trim() ?? "",
      level: Number(heading.tagName[1]),
    }));
}

/** Scrolls to a heading in a rendered document (and focuses it, for keyboard users). */
export function scrollToHeading(container: HTMLElement | null, id: string) {
  const heading = container?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
  if (!heading) return;

  heading.scrollIntoView();
  heading.setAttribute("tabindex", "-1");
  heading.focus();
}
