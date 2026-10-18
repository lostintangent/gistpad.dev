import { Button } from "@/shared/ui/button";
import { ChevronDown } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const TldrawCanvas = lazy(() => import("./TldrawCanvas"));

/** A whiteboard that's embedded in a file (via a ```tldraw block). */
export interface Whiteboard {
  /** Identifies the whiteboard, so that it's reloaded when it changes (e.g. when another file opens). */
  key: string;
  snapshot: string | undefined;
  onChange: (serialize: () => string) => void;
}

export function TLDraw({
  whiteboard,
  isReadOnly = false,
}: {
  whiteboard: Whiteboard;
  isReadOnly?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isExpanded) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setIsExpanded(true)}>
        <ChevronDown />
        Expand whiteboard
      </Button>
    );
  }

  return (
    <Suspense fallback={<div className="aspect-video animate-pulse rounded-md bg-muted" />}>
      <TldrawCanvas
        key={whiteboard.key}
        snapshot={whiteboard.snapshot}
        isReadOnly={isReadOnly}
        onChange={whiteboard.onChange}
        onCollapse={() => setIsExpanded(false)}
      />
    </Suspense>
  );
}
