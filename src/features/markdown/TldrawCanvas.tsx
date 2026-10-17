import { Button } from "@/shared/ui/button";
import { X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import {
  createTLStore,
  DefaultMainMenu,
  DefaultMainMenuContent,
  getSnapshot,
  loadSnapshot,
  Tldraw,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  type Editor,
} from "tldraw";
import "tldraw/tldraw.css";

// The whiteboard itself, which is loaded on demand (since tldraw is large).

export default function TldrawCanvas({
  snapshot,
  isReadOnly,
  onChange,
  onCollapse,
}: {
  /** The whiteboard's saved state (if it has any). */
  snapshot: string | undefined;
  isReadOnly: boolean;
  /** Called when the user edits the whiteboard, with a function that serializes it. */
  onChange: (serialize: () => string) => void;
  onCollapse: () => void;
}) {
  const [store] = useState(() => {
    const store = createTLStore();
    if (snapshot) loadSnapshot(store, JSON.parse(snapshot));
    return store;
  });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // (The whiteboard becomes read-only when viewing a past revision)
  useEffect(() => {
    editor?.updateInstanceState({ isReadonly: isReadOnly });
  }, [editor, isReadOnly]);

  const handleChange = useEffectEvent(() => onChange(() => JSON.stringify(getSnapshot(store))));
  useEffect(() => store.listen(handleChange, { scope: "document", source: "user" }), [store]);

  const whiteboard = (
    <Tldraw
      store={store}
      inferDarkMode
      options={{ maxPages: 1 }}
      onMount={setEditor}
      components={{
        MainMenu: () => (
          <DefaultMainMenu>
            <TldrawUiMenuGroup id="custom">
              {!isFullscreen && (
                <TldrawUiMenuItem
                  id="collapse"
                  label="Collapse whiteboard"
                  icon="minimize"
                  readonlyOk
                  onSelect={onCollapse}
                />
              )}
              <TldrawUiMenuItem
                id="expand"
                label={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
                icon={isFullscreen ? "minimize" : "maximize"}
                readonlyOk
                onSelect={() => setIsFullscreen(!isFullscreen)}
              />
            </TldrawUiMenuGroup>
            <DefaultMainMenuContent />
          </DefaultMainMenu>
        ),
      }}
    />
  );

  return isFullscreen ? (
    createPortal(
      <div className="fixed inset-0 z-50 bg-background">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-50"
          onClick={() => setIsFullscreen(false)}
        >
          <X />
        </Button>
        {whiteboard}
      </div>,
      document.body,
    )
  ) : (
    <div className="aspect-video">{whiteboard}</div>
  );
}
