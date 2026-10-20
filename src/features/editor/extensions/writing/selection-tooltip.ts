import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, showTooltip, ViewPlugin } from "@codemirror/view";

// A tooltip above the selected text (e.g. for formatting it), whose content is mounted into it by
// the editor's host (since it's rendered with React). While the selection is being dragged with
// the mouse, there's no tooltip, so it doesn't get in the way of the drag.

const setDragging = StateEffect.define<boolean>();

/** Whether the selection is being dragged (with the mouse). */
const dragging = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) if (effect.is(setDragging)) value = effect.value;
    return value;
  },
});

/** Tracks the mouse's drags, which end wherever the mouse is released (not only over the editor). */
const trackDragging = ViewPlugin.fromClass(
  class {
    constructor(private readonly view: EditorView) {
      window.addEventListener("mouseup", this.release);
    }

    release = () => this.set(false);

    set(isDragging: boolean) {
      if (this.view.state.field(dragging) !== isDragging) {
        this.view.dispatch({ effects: setDragging.of(isDragging) });
      }
    }

    destroy() {
      window.removeEventListener("mouseup", this.release);
    }
  },
  {
    eventObservers: {
      mousedown(event) {
        if (event.button === 0) this.set(true);
      },
    },
  },
);

// The tooltip is a bare container for its content (which draws its own surface), and is only shown
// while the editor is focused (e.g. not while a comment is being written)
const theme = EditorView.baseTheme({
  ".cm-tooltip.cm-tooltip-selection": { border: "none", background: "none" },
  "&:not(.cm-focused) .cm-tooltip-selection": { visibility: "hidden" },
});

/**
 * Shows a tooltip above the selected text, which `host` fills once it's shown (e.g. with a React
 * portal), and empties once it's hidden. The tooltip is remade whenever the selection changes (a
 * new one is mounted before the old one is unmounted), so that it's placed above the selection
 * whenever there's room, rather than staying on the side it last had to flip to (e.g. below the
 * first line), as CodeMirror keeps a tooltip whose `create` it has seen before.
 */
export function selectionTooltip(host: {
  mount: (dom: HTMLElement) => void;
  unmount: (dom: HTMLElement) => void;
}): Extension {
  return [
    dragging,
    trackDragging,
    theme,
    // (There's nothing to do to a selection in a read-only editor, e.g. a past revision)
    showTooltip.compute([dragging, EditorState.readOnly, "selection"], (state) => {
      const { from, to } = state.selection.main;
      if (from === to || state.field(dragging) || state.readOnly) return null;

      return {
        pos: from,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-tooltip-selection";
          return {
            dom,
            offset: { x: 0, y: 6 },
            mount: () => host.mount(dom),
            destroy: () => host.unmount(dom),
          };
        },
      };
    }),
  ];
}
