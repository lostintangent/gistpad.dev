import { Button } from "@/shared/ui/button";
import { useDocument } from "@/features/editor/document";
import { setEmbeddedFile } from "@/features/editor/store";
import { ChevronDown } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const TldrawCanvas = lazy(() => import("./TldrawCanvas"));

/** A whiteboard that's embedded in a document (via a ```tldraw block), and saved as a sidecar file. */
export function TLDraw({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const doc = useDocument();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!doc.gist || doc.isLoading) return null;

  if (!isExpanded) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setIsExpanded(true)}>
        <ChevronDown />
        Expand whiteboard
      </Button>
    );
  }

  const filename = `${doc.filename}.tldraw`;

  return (
    <Suspense fallback={<div className="aspect-video animate-pulse rounded-md bg-muted" />}>
      <TldrawCanvas
        key={doc.documentKey}
        snapshot={doc.gist.files[filename]?.content}
        isReadOnly={isReadOnly}
        onChange={(serialize) =>
          setEmbeddedFile(doc.documentKey, doc.savedContent, filename, serialize)
        }
        onCollapse={() => setIsExpanded(false)}
      />
    </Suspense>
  );
}
