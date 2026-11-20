import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import type { AgentRequest } from "../../model/request";
import type { Answer } from "../../ask/answer";
import type { Review } from "../../review/review";
import { gradeScenario } from "./grade";
import { isMode, loadScenarios, type AgentEvalMode, type Scenario } from "./parse";
import { PRICE_AS_OF, PRICE_TIER, addUsd, readUsage, type UsageEntry } from "./usage";

const ROOT = join(import.meta.dir, "../../../../..");
const ABORT_MS = 180_000;
const MAX_TURNS = 4;
const MAX_OUTPUT_TOKENS = 8_000;

function hash(text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function gitMeta() {
  const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: ROOT, stdout: "pipe" });
  const status = Bun.spawnSync(["git", "status", "--porcelain"], {
    cwd: ROOT,
    stdout: "pipe",
  });
  return {
    commit: commit.exitCode === 0 ? commit.stdout.toString().trim() : "unknown",
    dirty: status.stdout.toString().trim().length > 0,
  };
}

function requirePositiveInt(flag: string, value: string) {
  const number = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(number)) {
    throw new Error(`--${flag} must be a positive integer`);
  }
  return number;
}

function parseCli(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      model: { type: "string" },
      mode: { type: "string" },
      scenario: { type: "string" },
      repeat: { type: "string" },
      jobs: { type: "string" },
      check: { type: "boolean" },
    },
  });
  const mode = values.mode;
  if (mode !== undefined && !isMode(mode)) {
    throw new Error("--mode must be ask, edit, or review");
  }
  return {
    model: values.model ?? "gpt-6-luna",
    mode,
    scenarioId: values.scenario,
    repeat: requirePositiveInt("repeat", values.repeat ?? "2"),
    jobs: requirePositiveInt("jobs", values.jobs ?? "1"),
    check: values.check ?? false,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

interface RunResult {
  mode: AgentEvalMode;
  prompt: string;
  answer: Answer | null;
  document: string;
  beforeDocument: string;
  review: Review | null;
  reviewEnded: boolean;
  patchApplied: boolean;
  patchFailures: string[];
  usage: UsageEntry[];
  renderedPrompt: string | null;
  renderedPromptHash: string | null;
  firstUsefulMs: number | null;
  responseId: string | null;
  latencyMs: number;
  error: string | null;
}

type CaseResult = ReturnType<typeof snapshotHashes> & {
  id: string;
  repeat: number;
  mode: AgentEvalMode;
  prompt: string;
  passIf: string;
  failIf: string;
  expectedText: string | null;
  run: RunResult | null;
  grade: ReturnType<typeof gradeScenario> | null;
  failed: boolean;
  error: string | null;
};

function snapshotHashes(item: Scenario) {
  return {
    fixtureHash: hash(item.fixtureText),
    scenarioHash: hash(item.sourceText),
    expectedHash: item.expectedText != null ? hash(item.expectedText) : null,
  };
}

export function checkPlan(scenarios: Scenario[]) {
  return scenarios.map((item) => {
    const expected = item.expectedPath ? "  expected.patch" : "";
    return `${item.id}  ${item.mode}${expected}`;
  });
}

function fence(language: string, text: string) {
  let ticks = "````";
  while (text.includes(ticks)) ticks += "`";
  return [ticks + language, text.replace(/\n+$/, ""), ticks];
}

function unifiedDiff(before: string, after: string) {
  if (before === after) return "unchanged";
  const dir = mkdtempSync(join(tmpdir(), "gistpad-eval-diff-"));
  try {
    writeFileSync(join(dir, "before.md"), before);
    writeFileSync(join(dir, "after.md"), after);
    const diff = Bun.spawnSync(
      [
        "git",
        "diff",
        "--no-index",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "--",
        "before.md",
        "after.md",
      ],
      { cwd: dir, stdout: "pipe", stderr: "pipe" },
    );
    if (diff.exitCode !== 0 && diff.exitCode !== 1) {
      throw new Error(`Could not render eval diff: ${diff.stderr.toString().trim()}`);
    }
    return diff.stdout.toString();
  } finally {
    rmSync(dir, { recursive: true });
  }
}

async function runScenario(options: {
  scenario: Scenario;
  model: string;
  apiKey: string;
}): Promise<RunResult> {
  const [{ runAgent }, { createOpenAIClient }] = await Promise.all([
    import("../../openai/agent"),
    import("../../openai/client"),
  ]);
  const beforeDocument = options.scenario.fixtureText;
  let document = options.scenario.selection ?? beforeDocument;
  let answer: Answer | null = null;
  let review: Review | null = null;
  let reviewEnded = false;
  let patchApplied = false;
  const patchFailures: string[] = [];
  const usage: UsageEntry[] = [];
  let renderedPrompt: string | null = null;
  let firstUsefulMs: number | null = null;
  let responseId: string | null = null;
  let error: string | null = null;
  const started = performance.now();
  const markUseful = () => {
    if (firstUsefulMs == null) firstUsefulMs = Math.round(performance.now() - started);
  };

  const request: AgentRequest = {
    mode: options.scenario.mode,
    prompt: options.scenario.prompt,
    document: {
      path: options.scenario.fixture,
      title: options.scenario.fixture.replace(/\.md$/, ""),
      content: document,
      isSelection: !!options.scenario.selection,
    },
    instructions: {},
    signal: AbortSignal.timeout(ABORT_MS),
    onProgress: () => {},
    onAnswer: (next) => {
      answer = next;
      if (next.text.trim()) markUseful();
    },
    onEditStart: () => {},
    onEdit: async (content) => {
      document = content;
      patchApplied = true;
      markUseful();
    },
    onReviewStart: () => {},
    onReview: (changes) => {
      review = { title: null, comments: [], followUp: null, ...review, ...changes };
      markUseful();
    },
    onReviewEnd: () => {
      reviewEnded = true;
    },
  };

  try {
    responseId = await runAgent(request, {
      client: createOpenAIClient(options.apiKey),
      model: options.model,
      includeGistTools: false,
      includeWebSearch: false,
      maxTurns: MAX_TURNS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      onUsage: (raw) => usage.push(readUsage(raw, options.model)),
      onPatch: (event) => {
        if (event.failed) patchFailures.push(event.output);
      },
      onPrompt: (prompt) => {
        renderedPrompt = `${prompt.instructions}\n${prompt.input}`;
      },
    });
  } catch (caught) {
    error = errorMessage(caught);
  }

  return {
    mode: options.scenario.mode,
    prompt: options.scenario.prompt,
    answer,
    document,
    beforeDocument,
    review,
    reviewEnded,
    patchApplied,
    patchFailures,
    usage,
    renderedPrompt,
    renderedPromptHash: renderedPrompt ? hash(renderedPrompt) : null,
    firstUsefulMs,
    responseId,
    latencyMs: Math.round(performance.now() - started),
    error,
  };
}

async function mapPool<T, R>(items: T[], jobs: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, worker));
  return results;
}

function runCost(run: RunResult | null) {
  return run && !run.error ? addUsd(run.usage.map((item) => item.estimated_usd)) : null;
}

function formatUsd(usd: number | null) {
  return usd === null ? "unknown" : usd.toFixed(8);
}

function cacheReadSummary(usage: UsageEntry[]) {
  if (usage.length === 0) return "not observed";
  let input = 0;
  let cached = 0;
  for (const entry of usage) {
    const tokens = entry.raw?.input_tokens;
    const reads = entry.raw?.input_tokens_details?.cached_tokens;
    if (
      tokens === undefined ||
      reads === undefined ||
      !Number.isSafeInteger(tokens) ||
      !Number.isSafeInteger(reads) ||
      tokens < 0 ||
      reads < 0 ||
      reads > tokens
    ) {
      return "unknown";
    }
    input += tokens;
    cached += reads;
  }
  return `${cached}/${input} (${input === 0 ? "n/a" : `${((cached / input) * 100).toFixed(1)}%`})`;
}

function renderMarkdown(
  model: string,
  results: CaseResult[],
  spend: { estimated_usd: number | null; known_usd: number },
  execution: { repeat: number; jobs: number; scenario: string | null; mode: AgentEvalMode | null },
  git: ReturnType<typeof gitMeta>,
) {
  const firstCalls = results.flatMap((result) => result.run?.usage.slice(0, 1) ?? []);
  const toolFollowUps = results.flatMap((result) => result.run?.usage.slice(1) ?? []);
  const lines = [
    `# Agent eval (${model})`,
    "",
    `Automated checks: ${results.filter((result) => !result.failed).length}/${results.length} passed. Quality verdicts are recorded separately in the comparison table.`,
    `Estimated total USD: ${formatUsd(spend.estimated_usd)}. Known usage subtotal: ${formatUsd(spend.known_usd)}.`,
    `Execution: ${execution.repeat} sample(s) per case, ${execution.jobs} concurrent case(s). Git: ${git.commit}${git.dirty ? " (dirty)" : ""}. Prices: ${PRICE_TIER}, ${PRICE_AS_OF}.`,
    `Selection: scenario ${execution.scenario ?? "all"}, mode ${execution.mode ?? "all"}.`,
    "",
    "Automated checks cover document oracles and response structure. A human or agent must apply the scorecards to assess semantic quality. Cost is estimated USD from actual token usage. Cache reads and writes are part of that cost, not a separate score.",
    "",
    "## Comparison",
    "",
    "Review every sample against its scorecard, then replace each **unreviewed** quality cell with **pass** or **fail** and explain failures below. An automatic failure blocks acceptance even if the output otherwise reads well. Include failed samples in cost comparisons; do not keep only the best repeat.",
    "",
    "| Case | Sample | Checks | Quality | USD | First output (ms) | Total (ms) | Initial cache reads/input | Tool-loop cache reads/input |",
    "| --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- |",
    ...results.map((result) => {
      const run = result.run;
      return `| ${result.id} | ${result.repeat} | ${result.failed ? "FAIL" : "pass"} | unreviewed | ${formatUsd(runCost(run))} | ${run?.firstUsefulMs ?? "none"} | ${run?.latencyMs ?? "n/a"} | ${cacheReadSummary(run?.usage.slice(0, 1) ?? [])} | ${cacheReadSummary(run?.usage.slice(1) ?? [])} |`;
    }),
    "",
    "Cache counts describe observed provider usage, not guaranteed cold/warm states. Every sample starts from the original fixture with no previous conversation. Sequential repeats can reveal reuse across identical requests, then across cases/modes for the same document. Parallel runs can overlap before a prefix is cached.",
    "",
    "| Observed requests | Count | Cache reads/input tokens |",
    "| --- | ---: | --- |",
    `| Initial calls | ${firstCalls.length} | ${cacheReadSummary(firstCalls)} |`,
    `| Tool-loop follow-ups | ${toolFollowUps.length} | ${cacheReadSummary(toolFollowUps)} |`,
    "",
    "Missing usage is not free usage. Cache counts can be partial on failed runs; complete USD stays unknown when a run fails or usage is incomplete. Full rendered prompts, raw usage with cache-write lifetimes, pricing diagnostics, and hashes are retained in [results.json](results.json).",
    "",
  ];
  for (const result of results) {
    lines.push(`## ${result.id}  repeat ${result.repeat}`);
    lines.push(
      `Mode: ${result.mode}`,
      "",
      result.prompt,
      "",
      "### Scorecard",
      "",
      "**Pass if**",
      "",
      result.passIf,
      "",
      "**Fail if**",
      "",
      result.failIf,
      "",
    );
    if (result.error) lines.push(`Run failed: ${result.error}`, "");
    if (result.grade) {
      lines.push(
        result.grade.passed
          ? "Automated checks passed. See the comparison table for the separate quality verdict."
          : "Automated checks failed:",
      );
      for (const failure of result.grade.failures) lines.push(`- ${failure}`);
    }
    if (result.run?.usage.length === 0) {
      lines.push("", "Cost unavailable: no provider usage reported.");
    }
    for (const reason of new Set(
      result.run?.usage.flatMap((entry) => (entry.invalid ? [entry.invalid] : [])) ?? [],
    )) {
      lines.push("", `Cost unavailable: ${reason}`);
    }
    if (result.run?.answer?.text) lines.push("", "### Answer", "", result.run.answer.text);
    if (result.mode === "edit" && result.run) {
      const after = result.grade?.finalDocument ?? result.run.document;
      lines.push("", "### Document", "");
      lines.push(
        "#### After vs before",
        "",
        ...fence("diff", unifiedDiff(result.run.beforeDocument, after)),
      );
      if (result.expectedText !== null) {
        lines.push(
          "",
          "#### After vs expected",
          "",
          ...fence("diff", unifiedDiff(after, result.expectedText)),
        );
      } else {
        lines.push("", "#### After vs expected", "", "No expected file.");
      }
    }
    if (result.run?.review) {
      lines.push(
        "",
        "### Review",
        "",
        ...fence("json", JSON.stringify(result.run.review, null, 2)),
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const cli = parseCli(Bun.argv.slice(2));
  const scenarios = loadScenarios(cli.scenarioId).filter(
    (scenario) => !cli.mode || scenario.mode === cli.mode,
  );
  if (scenarios.length === 0) throw new Error("No eval cases found");
  const hashesByScenario = new Map(scenarios.map((item) => [item, snapshotHashes(item)]));
  const groups = new Set(scenarios.map((scenario) => scenario.id.split("/")[0])).size;
  console.log(`${scenarios.length} case(s) across ${groups} scenario(s), model ${cli.model}`);
  console.log(
    `${cli.repeat} sample(s) per case, ${scenarios.length * cli.repeat} execution(s), ${cli.jobs} concurrent case(s)`,
  );
  for (const line of checkPlan(scenarios)) console.log(line);
  if (cli.check) {
    console.log("Validated cases. No model calls.");
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required unless you pass --check");

  const { setTracingDisabled } = await import("@openai/agents");
  setTracingDisabled(true);
  const git = gitMeta();
  const execution = {
    repeat: cli.repeat,
    jobs: cli.jobs,
    scenario: cli.scenarioId ?? null,
    mode: cli.mode ?? null,
  };
  const work = scenarios.flatMap((item) =>
    Array.from({ length: cli.repeat }, (_, repeat) => ({ item, repeat: repeat + 1 })),
  );

  const results = await mapPool(work, cli.jobs, async ({ item, repeat }): Promise<CaseResult> => {
    const result: CaseResult = {
      id: item.id,
      repeat,
      mode: item.mode,
      prompt: item.prompt,
      passIf: item.passIf,
      failIf: item.failIf,
      expectedText: item.expectedText ?? null,
      run: null,
      grade: null,
      failed: false,
      error: null,
      ...hashesByScenario.get(item)!,
    };
    try {
      result.run = await runScenario({ scenario: item, model: cli.model, apiKey });
      result.grade = gradeScenario(item, result.run);
      result.failed = !!result.run.error || !result.grade.passed;
      result.error = result.run.error;
    } catch (caught) {
      result.failed = true;
      result.error = errorMessage(caught);
    }
    console.log(
      `${item.id} #${repeat}: ${result.failed ? "FAIL" : "checks pass"}, USD ${formatUsd(runCost(result.run))}, ${result.run?.latencyMs ?? "n/a"}ms`,
    );
    return result;
  });

  const usages = results.flatMap((result) => result.run?.usage ?? []);
  const estimatedUsd = addUsd(results.map((result) => runCost(result.run)));
  const spend = {
    estimated_usd: estimatedUsd,
    known_usd: usages.reduce((sum, item) => sum + (item.estimated_usd ?? 0), 0),
    unknown: estimatedUsd == null,
  };
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const outDir = join(ROOT, ".eval-results", stamp);
  mkdirSync(outDir, { recursive: true });
  const payload = {
    model: cli.model,
    git,
    execution,
    price: { as_of: PRICE_AS_OF, tier: PRICE_TIER },
    safety: {
      abortAfterMs: ABORT_MS,
      maxTurns: MAX_TURNS,
      maxOutputTokensPerResponse: MAX_OUTPUT_TOKENS,
      note: "Fixed eval limits. Abort cannot uncharge a Responses call that already started.",
    },
    spend,
    results,
  };
  const jsonResults = results.map((result) => {
    const { expectedText: _expectedText, ...rest } = result;
    return rest;
  });
  writeFileSync(
    join(outDir, "results.json"),
    JSON.stringify({ ...payload, results: jsonResults }, null, 2),
  );
  writeFileSync(
    join(outDir, "results.md"),
    renderMarkdown(cli.model, results, spend, execution, git),
  );
  console.log(
    `Checks: ${results.filter((result) => !result.failed).length}/${results.length}; quality unreviewed; estimated USD ${formatUsd(spend.estimated_usd)}`,
  );
  console.log(`wrote ${relative(ROOT, outDir)}`);
  if (results.some((result) => result.failed)) process.exitCode = 1;
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
