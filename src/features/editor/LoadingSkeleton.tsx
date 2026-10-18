import { Skeleton } from "@/shared/ui/skeleton";

/** A placeholder for the editor or preview, while the document is loading. */
export default function LoadingSkeleton() {
  return (
    <div className="p-2 space-y-4 h-full">
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
