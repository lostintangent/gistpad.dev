import type { GistComment } from "@/shared/github";

// Formats additional context (that the user provides) for the agent's prompts.

/** Another gist or file that the user referenced in their command (e.g. `@gist`). */
export interface AdditionalReference {
  title: string;
  content: string;
}

export function referencesAsContext(references?: AdditionalReference[]) {
  if (!references?.length) return "";

  const refs = references.map(
    ({ title, content }) =>
      `<reference>\n<title>${title}</title>\n<content>\n${content}\n</content>\n</reference>`,
  );

  return `<additional_references>\n${refs.join("\n")}\n</additional_references>`;
}

export function userCommentsAsContext(comments?: GistComment[]) {
  if (!comments?.length) return "";

  const notes = comments.map(({ body }) => `<note>\n${body}\n</note>`);

  return `<user_notes>
Here are some notes that I've taken about the document (which may include a reference to sections using a markdown blockquote), which may provide meaningful context and insight about the content:

${notes.join("\n")}
</user_notes>`;
}
