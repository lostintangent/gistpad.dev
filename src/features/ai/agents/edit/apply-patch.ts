// Based on the reference implementation from
// https://cookbook.openai.com/examples/gpt4-1_prompting_guide#reference-implementation-apply_patchpy,
// trimmed down to the single "*** Update File" (or "*** Add File") section that the edit agent
// generates.

/** A change within a patch section, positioned relative to the start of the section's context. */
interface Chunk {
  offset: number;
  deleteCount: number;
  insert: string[];
}

// Models almost always emit ASCII punctuation, even when a document contains look-alikes
// (e.g. an em dash, or curly quotes), so lines are canonicalised before they're compared.
const canon = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[‐-—−]/g, "-")
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‛]/g, "'")
    .replace(/[  ]/g, " ");

/** Finds where `context` starts in `lines` (from `start`), ignoring more whitespace each pass. */
function findContext(lines: string[], context: string[], start: number) {
  if (context.length === 0) return start;

  for (const trim of [(s: string) => s, (s: string) => s.trimEnd(), (s: string) => s.trim()]) {
    const target = canon(context.map(trim).join("\n"));
    for (let i = start; i < lines.length; i++) {
      const segment = lines.slice(i, i + context.length).map(trim);
      if (canon(segment.join("\n")) === target) return i;
    }
  }

  return -1;
}

/** Applies a patch (in the V4A format that the edit agent's prompt describes) to a document. */
export function applyPatch(patch: string, content: string) {
  if (!patch.startsWith("*** Begin Patch\n")) {
    throw new Error("Patch must start with *** Begin Patch\\n");
  }

  const lines = patch.trim().split("\n");
  if (lines.at(-1) !== "*** End Patch") {
    throw new Error("Invalid patch text: Patch text must end with the correct patch suffix.");
  }

  const fileLines = content.split("\n");
  const output: string[] = [];
  let copied = 0; // The number of file lines that have been copied to the output
  let cursor = 0; // The file line that the search for the next section's context starts at
  let i = 1;

  if (lines[i].startsWith("*** Update File: ")) {
    i++;
    while (!lines[i].startsWith("*** ")) {
      // Every section after the first must start with an "@@" delimiter, which can
      // include a line (e.g. a heading) that the section's context comes after.
      if (lines[i].startsWith("@@")) {
        // Move the cursor past the anchor (unless it's already behind the cursor), matching
        // it exactly first, and then ignoring its surrounding whitespace.
        const anchor = lines[i++].slice(2).trimStart();
        if (anchor.trim()) {
          for (const trim of [(s: string) => s, (s: string) => s.trim()]) {
            const matches = (line: string) => canon(trim(line)) === canon(trim(anchor));
            if (fileLines.slice(0, cursor).some(matches)) continue;

            const found = fileLines.findIndex((line, j) => j >= cursor && matches(line));
            if (found !== -1) {
              cursor = found + 1;
              break;
            }
          }
        }
      } else if (cursor !== 0) {
        throw new Error(`Invalid Line:\n${lines[i]}`);
      }

      // A section's lines run until the next delimiter, or "***" marker.
      const context: string[] = [];
      const chunks: Chunk[] = [];
      let chunk: Chunk | undefined;
      for (; !/^(@@|\*\*\*( |$))/.test(lines[i]); i++) {
        if (lines[i].startsWith("***")) throw new Error(`Invalid Line: ${lines[i]}`);

        // Context lines should start with a space, but models sometimes leave it out.
        const [type, text] = /^[-+]/.test(lines[i])
          ? [lines[i][0], lines[i].slice(1)]
          : [" ", lines[i].replace(/^ /, "")];

        if (type === " ") {
          chunk = undefined;
          context.push(text);
          continue;
        }

        if (!chunk) chunks.push((chunk = { offset: context.length, deleteCount: 0, insert: [] }));
        if (type === "+") {
          chunk.insert.push(text);
        } else {
          chunk.deleteCount++;
          context.push(text);
        }
      }

      // Sections that end with an "*** End of File" marker are matched against the end of
      // the file first.
      const eof = lines[i] === "*** End of File";
      if (eof) i++;

      let index = eof ? findContext(fileLines, context, fileLines.length - context.length) : -1;
      if (index === -1) index = findContext(fileLines, context, cursor);
      if (index === -1) {
        throw new Error(`Invalid ${eof ? "EOF " : ""}Context ${cursor}:\n${context.join("\n")}`);
      }

      for (const { offset, deleteCount, insert } of chunks) {
        const start = index + offset;
        if (copied > start) throw new Error(`orig_index ${copied} > chunk.orig_index ${start}`);

        output.push(...fileLines.slice(copied, start), ...insert);
        copied = start + deleteCount;
      }

      cursor = index + context.length;
    }
  } else if (lines[i].startsWith("*** Add File: ")) {
    // Models sometimes "add" an empty (or new) document, which replaces it with the added lines.
    for (i++; !lines[i].startsWith("*** "); i++) {
      if (!lines[i].startsWith("+")) throw new Error(`Invalid Add File Line: ${lines[i]}`);
      output.push(lines[i].slice(1));
    }
    copied = fileLines.length;
  }

  if (!lines[i].startsWith("*** End Patch")) throw new Error(`Unknown Line: ${lines[i]}`);
  return [...output, ...fileLines.slice(copied)].join("\n");
}
