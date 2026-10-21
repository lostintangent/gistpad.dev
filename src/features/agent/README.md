# Agent

GistPad's agent is a writing assistant for the user's documents (gists). It responds to commands by answering
questions, editing or reviewing the document, or researching a topic. The user can also talk with it, through a
voice assistant that runs commands on the agent.

## How it's organized

**`model/`**: what the agent is, independent of any SDK.

- `modes.ts`: the kinds of commands (ask, edit, review, and research), the composer's modes (which add
  "auto" and "talk"), and what the agent can do in the current context.
- `request.ts`: a request to the agent (a command, its context, and the callbacks that its response streams
  into), and the prompt that it becomes.
- `context.ts`: the context that's given with a request (e.g. the user's document and notes).
- `input.ts`: user-configured **AgentCommands** (slash commands), their mode-specific discovery,
  and shared input preparation before an agent request is classified or executed.
- `instructions.ts`: the agent's instructions, which are composed from how it decides to respond (see `auto/`),
  and the modes that it can respond with.
- `tools.ts`: how tools are defined, and `gistTools.ts`: the tools that are always available (reading the user's
  other gists).
- `response.ts`: what answers and reviews share (follow-ups and citations).
- `useAgent.tsx` and `store.ts`: run commands, and track their state for the UI.

**A folder per mode**, which defines its instructions, tools, and response (and when the agent should choose it),
alongside its UI:

- `auto/`: how a command's mode is decided, either by detecting it locally (from its first word), or by letting
  the agent choose between the modes that it can respond with.
- `ask/`: answers, which are a structured output that streams in.
- `edit/`: edits, which are patches to the document (that the user can accept or undo).
- `review/`: reviews, whose comments stream in as the review tool's arguments.
- `research/`: research tasks, which run in the background and create a new document.
- `talk/`: voice conversations, where the assistant runs commands on the agent (and shares its context and
  tools). `talk.ts` defines the session (as the UI sees it) and the connection it runs over (which a
  runtime opens, with one of the voices), and `useTalkSession` drives the one with the other.

**`openai/`**: the runtime, which fulfils requests (and opens talk connections) with OpenAI's SDKs, by adapting the
definitions above to them (e.g. tools and schemas), and mapping their events back to the request's callbacks.

**`composer/`**, **`settings/`**, and **`shared/`**: the agent's UI (where commands are written), the user's
settings (e.g. models, instructions, and voices), and the pieces of UI that the modes share.

## Commands and the action bar

An **AgentCommand** is a user-configured instruction aimed at the agent, not an application command
definition. Its slash name, prompt, description, scope, and default mode come from the existing
`edit.commands` or `review.commands` settings. An **AgentRequest** is a particular prepared request
sent to the runtime.

`composer/commands` adapts modes, configuration dialogs, voice controls, and slash commands into the
application's **Command** registry. Modes are state; selecting a mode is a command. Settings are
configuration; opening their dialogs is a command. The mode menu and palette consume those same
definitions. Supplying text to a mode command submits it; invoking it without text selects the mode.

The workbench owns the shared **action bar**, and `AgentComposer` is one of its two surfaces
(beside `CommandPalette`). The composer owns its draft, selected mode, dialogs, results and voice
session, but not the bar or the palette, and it stays mounted while the palette shows. It hands
the bar an `ActionBarSurface`: its panels, the mode menu (as the leading control's menu, which
keeps its own contents and focus policy), the prompt, and a send or cancel control. The workbench
owns the row's geometry and the controls' chrome.

The edit panel uses a content-sized row with even padding, a centered separator, and a compact diff
toggle. Its actions and statistics use muted red/green colors. Reject uses the same destructive
button variant as the editor toolbar; accept uses its green equivalent.

Slash expansion happens once in `useAgent.run`, so composer submissions, palette invocations,
follow-ups, and explicit voice adapters share the same preparation.

The app's commands are also the agent's catalog of actions (`model/commandCatalog.ts`): a command
that declares what it does for the agent (`Command.agent`) is described to the voice assistant (in
a `<commands>` tag that's re-shared when it changes), which runs it with one `run_command` tool, by
id, through the same `executeCommand` that buttons and the palette use. So a feature exposes an
action to the agent by registering a command with that one sentence, and the voice tools that
remain are the ones that carry content (e.g. a new file's) or need the agent's results.

## Conventions

- Mode definitions only build on the model's primitives (`context`, `tools`, and `response`), and the model then
  composes them (in `instructions` and `request`). So they never import the request, the store, or an SDK.
- The SDKs (and prompts) are large, and only needed once a command runs, so `openai/` (and the definitions that
  it uses) are loaded on demand: `await import("../openai")`. The UI only imports their types.
- Editing is the exception to the agent's tools being SDK-agnostic: it uses OpenAI's native `apply_patch` tool
  (which its models are trained to call), so `edit/` only defines its name and instructions, and
  `openai/tools.ts` binds it to the document.
