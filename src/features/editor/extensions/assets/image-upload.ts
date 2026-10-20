import { uploadImage } from "@/shared/supabase";
import { Facet, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import { toast } from "sonner";

const settings = Facet.define<{ gistId: string; asHtml: boolean }>();
const addUpload = StateEffect.define<{ id: object; pos: number }>();
const removeUpload = StateEffect.define<object>();

class UploadPlaceholder extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-image-upload";
    span.textContent = "Uploading image...";
    return span;
  }
}

/** Pending uploads follow edits without putting temporary text in the file or its undo history. */
const placeholders = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    if (tr.state.readOnly) return Decoration.none;

    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addUpload)) {
        decorations = decorations.update({
          add: [
            Decoration.widget({
              widget: new UploadPlaceholder(),
              id: effect.value.id,
              side: 1,
            }).range(effect.value.pos),
          ],
        });
      } else if (effect.is(removeUpload)) {
        decorations = decorations.update({
          filter: (_from, _to, value) => value.spec.id !== effect.value,
        });
      }
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** The image among the items being pasted or dropped (if any). */
export const findImage = (items?: DataTransferItemList) =>
  Array.from(items ?? []).find((item) => item.kind === "file" && item.type.startsWith("image/"));

const uploader = ViewPlugin.fromClass(
  class {
    destroyed = false;

    constructor(readonly view: EditorView) {}

    async insert(image: File, at: number) {
      const { view } = this;
      const { gistId, asHtml } = view.state.facet(settings)[0];
      const id = {};
      view.dispatch({ effects: addUpload.of({ id, pos: at }) });

      let url: string;
      try {
        url = await uploadImage(gistId, image);
      } catch {
        if (!this.destroyed) view.dispatch({ effects: removeUpload.of(id) });
        toast.error("Failed to upload image");
        return;
      }

      if (this.destroyed) return;

      let pos: number | null = null;
      view.state.field(placeholders).between(0, view.state.doc.length, (from, _to, value) => {
        if (value.spec.id === id) pos = from;
      });
      // Deleting the surrounding content (or making the editor read-only) cancels insertion.
      if (pos === null) return;

      const insert = asHtml ? `<img src="${url}" />` : `![Image](${url})`;
      view.dispatch({
        changes: { from: pos, insert },
        effects: removeUpload.of(id),
        userEvent: "input",
      });
    }

    destroy() {
      this.destroyed = true;
    }
  },
  {
    eventHandlers: {
      paste(event) {
        if (this.view.state.readOnly) return false;
        const image = findImage(event.clipboardData?.items)?.getAsFile();
        if (!image) return false;

        this.insert(image, this.view.state.selection.main.from);
        return true;
      },
      drop(event) {
        if (this.view.state.readOnly) return false;
        const image = findImage(event.dataTransfer?.items)?.getAsFile();
        if (!image) return false;

        const at = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
        this.insert(image, at ?? this.view.state.selection.main.from);
        return true;
      },
    },
  },
);

const theme = EditorView.baseTheme({
  ".cm-image-upload": { color: "var(--muted-foreground)", fontStyle: "italic" },
});

/** Uploads pasted or dropped images, keeping their insertion points anchored while they upload. */
export const imageUpload = (gistId: string, asHtml: boolean) => [
  settings.of({ gistId, asHtml }),
  placeholders,
  uploader,
  theme,
];
