import { lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { splitFrontMatter } from "@/shared/frontMatter";

export const EVAL_DIR = join(import.meta.dir, "..");
export const SCENARIOS_DIR = join(EVAL_DIR, "scenarios");

const MODES = ["ask", "edit", "review"] as const;

const metadataSchema = z.strictObject({
  selection: z
    .string()
    .refine((value) => value.trim().length > 0)
    .optional(),
  expect_unchanged: z.boolean().default(false),
});

export type AgentEvalMode = (typeof MODES)[number];

export function isMode(value: string): value is AgentEvalMode {
  return (MODES as readonly string[]).includes(value);
}

export interface Scenario {
  id: string;
  path: string;
  sourceText: string;
  fixture: string;
  fixturePath: string;
  fixtureText: string;
  mode: AgentEvalMode;
  prompt: string;
  passIf: string;
  failIf: string;
  selection?: string;
  expectUnchanged: boolean;
  expectedPath?: string;
  expectedText?: string;
}

function isEnoent(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}

function requireScorecard(body: string, file: string) {
  const pass = body.match(/^## Pass if\n([\s\S]*?)(?=^## )/m);
  const fail = body.match(/^## Fail if\n([\s\S]*)$/m);
  if (!pass || !fail) throw new Error(`${file}: scorecard needs ## Pass if and ## Fail if`);
  const passIf = pass[1].trim();
  const failIf = fail[1].trim();
  if (!passIf) throw new Error(`${file}: ## Pass if is empty`);
  if (!failIf) throw new Error(`${file}: ## Fail if is empty`);
  return { passIf, failIf };
}

function userPrompt(body: string) {
  const index = body.search(/^## Pass if/m);
  return (index === -1 ? body : body.slice(0, index)).trim();
}

export function uniqueSelection(fixture: string, selection: string, file: string) {
  const start = fixture.indexOf(selection);
  if (start === -1) throw new Error(`${file}: selection was not found in the fixture`);
  if (fixture.indexOf(selection, start + 1) !== -1) {
    throw new Error(`${file}: selection must occur exactly once in the fixture`);
  }
  return start;
}

export function spliceSelection(fixture: string, selection: string, edited: string, file: string) {
  const start = uniqueSelection(fixture, selection, file);
  return fixture.slice(0, start) + edited + fixture.slice(start + selection.length);
}

function readFixture(dir: string, group: string) {
  const path = join(dir, "fixture.md");
  try {
    return { path, text: readFileSync(path, "utf8") };
  } catch (error) {
    if (isEnoent(error)) throw new Error(`${group}: missing fixture.md`, { cause: error });
    throw error;
  }
}

function parseMetadata(source: string, file: string) {
  const { frontMatterYaml, content } = splitFrontMatter(source);
  if (frontMatterYaml === undefined) {
    return { content, selection: undefined as string | undefined, expectUnchanged: false };
  }
  const parsed = metadataSchema.safeParse(parseYaml(frontMatterYaml) ?? {});
  if (!parsed.success) {
    throw new Error(`${file}: ${parsed.error.message}`, { cause: parsed.error });
  }
  return {
    content,
    selection: parsed.data.selection?.replace(/\n$/, ""),
    expectUnchanged: parsed.data.expect_unchanged,
  };
}

function expectedDocument(fixture: string, patch: string, file: string) {
  const dir = mkdtempSync(join(tmpdir(), "gistpad-eval-expected-"));
  const target = join(dir, "fixture.md");
  const apply = (...args: string[]) =>
    Bun.spawnSync(["git", "apply", "--recount", ...args, "-"], {
      cwd: dir,
      stdin: Buffer.from(patch),
      stdout: "pipe",
      stderr: "pipe",
    });
  try {
    const stat = apply("--numstat");
    if (stat.exitCode !== 0 || !/^\d+\t\d+\tfixture\.md\n?$/.test(stat.stdout.toString())) {
      throw new Error(
        `${file}: expected patch must change only fixture.md. ${stat.stderr.toString().trim()}`,
      );
    }
    writeFileSync(target, fixture);
    const result = apply("--whitespace=nowarn");
    if (result.exitCode !== 0) {
      throw new Error(`${file}: expected patch does not apply. ${result.stderr.toString().trim()}`);
    }
    if (!lstatSync(target).isFile()) {
      throw new Error(`${file}: expected patch must leave fixture.md as a regular file`);
    }
    return readFileSync(target, "utf8");
  } finally {
    rmSync(dir, { recursive: true });
  }
}

export function parseCase(
  source: string,
  file: string,
  group: string,
  mode: AgentEvalMode,
  fixturePath: string,
  fixtureText: string,
): Scenario {
  const id = `${group}/${mode}/${basename(file, ".md")}`;
  const { content, selection, expectUnchanged } = parseMetadata(source, file);
  const prompt = userPrompt(content);
  if (!prompt) throw new Error(`${file}: missing user request`);
  const { passIf, failIf } = requireScorecard(content, file);
  if (selection) uniqueSelection(fixtureText, selection, file);

  const expectedPath = file.replace(/\.md$/, ".expected.patch");
  let patch: string | undefined;
  try {
    patch = readFileSync(expectedPath, "utf8");
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }
  const expectedText =
    patch === undefined ? undefined : expectedDocument(fixtureText, patch, expectedPath);

  return {
    id,
    path: file,
    sourceText: source,
    fixture: `${group}.md`,
    fixturePath,
    fixtureText,
    mode,
    prompt,
    passIf,
    failIf,
    selection,
    expectUnchanged,
    expectedPath: expectedText !== undefined ? expectedPath : undefined,
    expectedText,
  };
}

function scenarioGroups() {
  return readdirSync(SCENARIOS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function loadMode(
  group: string,
  mode: AgentEvalMode,
  fixturePath: string,
  fixtureText: string,
): Scenario[] {
  const dir = join(SCENARIOS_DIR, group, mode);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (error) {
    if (isEnoent(error)) return [];
    throw error;
  }
  return names
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const path = join(dir, name);
      return parseCase(readFileSync(path, "utf8"), path, group, mode, fixturePath, fixtureText);
    });
}

function loadGroup(group: string): Scenario[] {
  const dir = join(SCENARIOS_DIR, group);
  const fixture = readFixture(dir, group);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (!isMode(entry.name)) throw new Error(`${group}: unexpected folder ${entry.name}`);
    } else if (entry.name !== "fixture.md") {
      throw new Error(`${group}: unexpected file ${entry.name}`);
    }
  }
  return MODES.flatMap((mode) => loadMode(group, mode, fixture.path, fixture.text));
}

export function loadScenarios(only?: string): Scenario[] {
  const groups = scenarioGroups();
  if (!only) return groups.flatMap(loadGroup);
  const parts = only.split("/");
  if (parts.some((part) => !part) || parts.length > 3) {
    throw new Error(`No scenario named ${only}`);
  }
  const [group, mode, name] = parts;
  if (!group || !groups.includes(group)) throw new Error(`No scenario named ${only}`);
  if (!mode) return loadGroup(group);
  if (!isMode(mode)) throw new Error(`No scenario named ${only}`);
  const fixture = readFixture(join(SCENARIOS_DIR, group), group);
  const inMode = loadMode(group, mode, fixture.path, fixture.text);
  if (!name) {
    if (inMode.length === 0) throw new Error(`No scenario named ${only}`);
    return inMode;
  }
  const matched = inMode.filter((item) => item.id === `${group}/${mode}/${name}`);
  if (matched.length === 0) throw new Error(`No scenario named ${only}`);
  return matched;
}
