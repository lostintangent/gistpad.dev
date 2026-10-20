# Commands

A **Command** is an application operation, not a palette row: a stable `id`, a `title`, `run`, its
availability (`disabled`), and optional `group`, `detail`, `icon`, `shortcut` and `checked`
metadata, which describe the same operation to every consumer.

## Ownership

- Features define their commands beside the state they act on (e.g. `useWorkspaceCommands` and
  `useGistCommands`), and register the discoverable ones with `useCommands` while that component is
  mounted. Registration follows the controller's lifetime, not its chrome: a hidden toolbar's
  commands stay registered.
- Buttons and menus consume commands by reference (`<CommandButton command={commands.save} />`),
  or, for one that's registered elsewhere, by id (`<CommandDropdownItem command="notes.today" />`).
  The adapters supply the command's label, icon, availability and toggle state; callers supply the
  presentation.
- The registry owns registration, lookup and execution. `executeCommand` is the one invocation
  boundary: it resolves ids at invocation time, enforces `disabled`, and reports failures to the
  user. Owners re-register freely (a new array each render) and keep their place in the catalog;
  the first registration of an id wins.
- `CommandShortcuts` binds the registered shortcuts, and `CommandPalette` discovers the same
  commands, so nothing is bound twice.

## The palette

`CommandPalette` is one of the action bar's two surfaces (see the workbench's README): the
registered commands that match a query, docked above the query. It owns the query, the page it's
on, and keyboard selection (through the shared `useCompletions`), and hands the bar an
`ActionBarSurface` to render. Escape and clicking away are the bar's to handle.

- A **CommandPage** is a palette-only collection of existing commands (e.g. a file's revisions),
  composed by the workbench. While browsing, a page stands in for its commands; when searching,
  they're found directly. Its optional `load` runs when it's opened (and `isLoading` shows a
  spinner); the feature owns the request.
- `searchOnly` keeps a large inventory (e.g. every gist) out of browsing without making it
  unsearchable. `acceptsInput` lets a command take the query as text, which the palette offers as
  a row ("New gist: …") after what the query matches.
