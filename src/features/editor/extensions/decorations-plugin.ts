import { type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/**
 * Creates a plugin that decorates the editor, and re-decorates it for every update that
 * `shouldRedecorate` returns true for (which, by default, is when the document changes).
 */
export const decorationsPlugin = (
  decorate: (view: EditorView) => DecorationSet,
  shouldRedecorate = (update: ViewUpdate) => update.docChanged,
) =>
  ViewPlugin.define(
    (view) => ({
      decorations: decorate(view),
      update(update: ViewUpdate) {
        if (shouldRedecorate(update)) this.decorations = decorate(update.view);
      },
    }),
    { decorations: (plugin) => plugin.decorations },
  );
