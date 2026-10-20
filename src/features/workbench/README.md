# Workbench

The workbench composes the application's feature surfaces and owns their layout and lifetime.
Feature workflows and agent behavior remain in their respective features.

## Action bar

`action-bar/ActionBar` is the card that floats over the workspace, which shows one of two
surfaces: the commands feature's **CommandPalette** (while searching), or the agent feature's
**AgentComposer**. Otherwise it's a search box. There's no surface registry: knowing these two is
intentional, and what they contain (agent modes, slash syntax, command implementations) isn't the
bar's concern.

A surface hands the bar an `ActionBarSurface` through a render prop: a `panel` docked above the
row, a `leading` control, the `input`, a `trailing` control or `hint`, and `isExpanded`/`isBusy`
hints for the card. Controls are plain data (an `icon`, a `label`, and an `onClick` or a `menu`
that the bar renders around its own trigger), so the bar owns the row's geometry and chrome, and
the controls and the input's inset never move between surfaces. `ActionBarView` renders a
surface; the workbench owns the metrics of `data-slot="action-bar-input"` parts (including the
prompt's highlight overlay). The palette and composer share a width, and an expanded answer can
use the wider workspace.

The bar owns the search session: the `workbench.search` command (Mod+K, which the agent's mode
menu also lists, and which typing `>` into an empty prompt runs), opening and closing, dismissal
with Escape or by clicking away, and giving the focus back afterwards. The composer stays mounted
while the palette shows, so its prompt, results and voice session are kept, and the palette's
query is separate from the prompt. On mobile, the composer gives way to the comments, which close
when the agent starts. The card's focused and centered states share a shadow, and its glow follows
the user's accent color.

## Controllers and consumers

`WorkbenchPage` registers the account, gist-list and layout commands, and `Workspace` registers
the open file's (through `workspace/commands`, which also owns the toolbar's editing state and
the palette's history page). Toolbars, panels, menus and shortcuts consume those same commands,
by reference or by id (e.g. the sidebar's footer, rail and menus all use the one `notes.today`
registration), so hiding a feature's chrome doesn't unregister its commands.

The document preview uses the shared `ScrollArea`, whose ref targets the scrollable viewport, so
heading navigation and editor-synchronized scrolling share one scroll surface.
