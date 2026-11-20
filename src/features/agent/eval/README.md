# GistPad agent eval

This is a simple eval harness for answering two questions about the GistPad agent:

1. **Quality** - How well does it handle real-world scenarios across questions, edit requests and reviews?
1. **Cost** - How efficient is its cost profile, in order to encourage confident everyday use?

| Term         | Meaning                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| **Harness**  | Code in `harness/` that loads cases, runs the real agent, grades, and writes reports                    |
| **Scenario** | A folder under `scenarios/` for one document and the cases that work on it                              |
| **Fixture**  | That folder’s `fixture.md`, the document under test                                                     |
| **Case**     | One user request and scorecard under `ask/`, `edit/`, or `review/`. Optional sibling `*.expected.patch` |

```text
bun run eval --check
bun run eval --mode ask
bun run eval --scenario list --mode edit
bun run eval --model gpt-6-luna --scenario list
bun run eval --model gpt-6-luna --scenario list/edit
bun run eval --model gpt-6-luna --scenario list/edit/move-entry
```

By default, each case runs **twice consecutively**, with **one case at a time**. Cases are grouped by document, then mode. Each sample starts from the original fixture and a fresh conversation, so an edit cannot contaminate the next case. `--repeat 1` is a quicker smoke run. `--jobs 4` allows parallelism, but is less useful for observing cache reuse between cases.

`--mode ask|edit|review` selects that mode across every document. Combine it with `--scenario` to narrow the selection further. An invalid mode or a selection with no matching cases fails before any API calls.

The list scenario includes mixed checked/unchecked to-dos. `list/ask/completed-tasks` checks completion-status reading, including `[x]` and `[X]`. `list/edit/complete-task` checks off one task, and `list/edit/compound-tasks` adds, completes, and deletes tasks in a single request. Both edits preserve all unrelated task states and document content.

`list/edit/complete-nested-task` also protects matching inline/fenced code and nested indentation. `list/edit/ambiguous-task` expects a clarification without edits when two tasks have the same name, paired with `list/edit/complete-both-tasks` to verify explicit bulk edits proceed without needless clarification. Report Ask cases include `missing-information` (do not invent an absent fact) and `filter-platforms` (combine price/year conditions and count the matches).

For paid runs, set `OPENAI_API_KEY` in your environment or the ignored `.env.local`. No GitHub token is needed.

`--check` validates files with no API calls. Paid runs use fixed limits: 4 turns, 8,000 output tokens per response, and a 3-minute abort. Nothing here is imported by the browser or `bun test`.

Each run writes `.eval-results/<timestamp>/results.md` and `results.json`. The Markdown report starts with a per-sample table of check results, quality verdicts awaiting review, cost, latency, and cache reads for initial calls versus tool-loop follow-ups, followed by scorecards and outputs/diffs. Full rendered prompts, original provider usage (including cache writes), pricing diagnostics, execution settings, and hashes stay in the linked JSON rather than being repeated in Markdown.

The runner checks exact edits, unchanged-document expectations, and response structure automatically. A human or agent should then read the outputs against each case's scorecard for factual accuracy, writing quality, and warranted feedback. Exit code 0 means the automatic checks passed, not that every scorecard passed.

## Expected edits

For an exact edit, add a sibling `case-name.expected.patch` containing a standard unified diff against `fixture.md`. Include only the changed lines and enough unchanged context to identify them:

```diff
--- a/fixture.md
+++ b/fixture.md
@@ -10,5 +10,5 @@
 Unchanged nearby paragraph.
 
-Old paragraph.
+New paragraph.
 
 Unchanged following paragraph.
```

The harness applies the patch to a temporary copy of the fixture, then compares the agent's **whole document** to that result. Unmentioned content must remain unchanged, not merely match a wildcard. Patches are not sent to the model. Git recalculates hunk counts, so adding lines does not require updating those counts manually.

`--check` rejects malformed or stale patches and patches targeting anything other than `fixture.md`, before any model calls. Keep the fixture and patch in sync when changing the intended content. Use `expect_unchanged: true` instead of an empty patch for a no-op case.

## Comparing changes

Run the unchanged cases before and after a production prompt/tool change, using the same model, repeat count, and concurrency. Keep both result folders. Review every sample against its scorecard and fill in the Markdown table's quality verdicts, with reasons for failures. An optimization is not accepted while automatic failures or quality regressions remain. Include all samples and failed attempts in cost comparisons, not only the cheapest successful result.

Use the initial-call cache columns to distinguish reuse between cases from the SDK's reuse after a tool call. Sample 1 is not guaranteed cold, and sample 2 is not guaranteed warm. Read the actual read/write counts and costs. The suite does not simulate accumulated conversation history, and two samples are a useful regression signal, not a reliability estimate.
