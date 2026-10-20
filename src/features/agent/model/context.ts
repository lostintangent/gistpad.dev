import type { ActiveFile } from "@/features/files/file";
import {
  getGistDescription,
  getGistDisplayName,
  getMarkdownFiles,
  isEmptyContent,
  toMarkdownFilename,
  type GistComment,
} from "@/shared/github";
import { readFile, readGists } from "@/features/gists/queries";
import { findReferences, REFERENCE_PATTERN } from "./input";

// The context that the agent is given with a request (e.g. the user's document), which is formatted
// the same way for the agent's prompts and the voice assistant's conversation (when talking).

/** The document (or selection) that the user is asking the agent about. */
export interface AgentDocument {
  path: string;
  title?: string;
  content: string;
  isSelection: boolean;
  /** The document's gist, whose other files can be read (with the `read_gist` tool). */
  gist?: { id: string; files: string[] };
}

/**
 * The active file (or a selection of it) as the document that the agent and the voice assistant are
 * given. A selection is the entire scope of a command, so it excludes the gist's other files.
 */
export function toAgentDocument(
  file: ActiveFile,
  content: string,
  isSelection = false,
): AgentDocument | undefined {
  if (!file.gistId) return undefined;

  return {
    path: file.filename,
    title: file.gist ? getGistDescription(file.gist) : undefined,
    content: isEmptyContent(content) ? "" : content,
    isSelection,
    gist: isSelection ? undefined : { id: file.gistId, files: getMarkdownFiles(file.gist) },
  };
}

const MAX_LISTED_FILES = 20;

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export function documentAsContext(document?: AgentDocument) {
  if (!document) return "";

  const { path, title, content, isSelection, gist } = document;
  const attributes = [
    `path="${escapeAttribute(path)}"`,
    title && `title="${escapeAttribute(title)}"`,
    isSelection && 'selection="true"',
    gist && `gist_id="${escapeAttribute(gist.id)}"`,
  ]
    .filter(Boolean)
    .join(" ");

  const otherFiles = gist?.files.filter((filename) => filename !== path) ?? [];
  const listedFiles = otherFiles.slice(0, MAX_LISTED_FILES).map((filename) => `* ${filename}`);
  if (otherFiles.length > MAX_LISTED_FILES) {
    listedFiles.push(`* (and ${otherFiles.length - MAX_LISTED_FILES} more)`);
  }

  return [
    `<current_document ${attributes}>\n${content}\n</current_document>`,
    listedFiles.length > 0 &&
      `<other_files_in_gist>\n${listedFiles.join("\n")}\n</other_files_in_gist>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Another gist or file that the user referenced in their command (e.g. `@gist`). */
export interface AdditionalReference {
  title: string;
  content: string;
}

/** References are context, regardless of which surface submitted the request. */
export async function resolveReferences(command: string, gistId: string | undefined) {
  const matches = findReferences(command);
  const gists = matches.some(({ symbol }) => symbol === "@") ? await readGists() : [];
  const references: AdditionalReference[] = [];
  for (const { symbol, name } of matches) {
    if (symbol === "@") {
      const gist = gists.find((gist) => getGistDisplayName(gist) === name);
      if (!gist) throw new Error(`No gist named "${name}" was found.`);
      references.push({ title: name, content: await readFile(gist.id) });
    } else {
      if (!gistId) throw new Error("File references require an open gist.");
      references.push({ title: name, content: await readFile(gistId, toMarkdownFilename(name)) });
    }
  }
  return { prompt: command.replace(REFERENCE_PATTERN, '"$2"'), references };
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
