import { Skeleton } from "@/shared/ui/skeleton";
import { useEditorMode } from "./mode";
import { editorPanelSizeAtom } from "./store";
import { useSelector } from "@tanstack/react-store";

function SkeletonPanel({ width, className = "" }: { width?: number; className?: string }) {
  return (
    <div
      className={`p-2 space-y-4 h-full ${className}`}
      style={width ? { width: `${width}%` } : undefined}
    >
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** A placeholder for the editor (and/or preview), while the document is loading. */
export default function LoadingSkeleton() {
  const [mode] = useEditorMode();
  const editorSize = useSelector(editorPanelSizeAtom);

  if (mode !== "split") return <SkeletonPanel />;

  return (
    <div className="flex h-full">
      <SkeletonPanel width={editorSize} className="border-r" />
      <SkeletonPanel width={100 - editorSize} />
    </div>
  );
}
