import { editorModeAtom } from "@/atoms";
import { Skeleton } from "@/components/ui/skeleton";
import { useAtomValue } from "jotai";

const skeletons = [...Array(2)].map(() => (
    <>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
    </>
));

function SkeletonPanel({
    isSplitMode = false,
    isLeftPanel = false,
    width,
}: {
    isSplitMode?: boolean;
    isLeftPanel?: boolean;
    width?: number;
}) {
    return (
        <div
            className={`p-2 space-y-4 h-full${isLeftPanel ? " border-r" : ""}`}
            style={isSplitMode ? { width: `${width ?? 50}%` } : undefined}
        >
            {skeletons}
        </div>
    );
}

export default function LoadingSkeleton({
    leftWidth,
}: {
    leftWidth?: number;
}) {
    const editorMode = useAtomValue(editorModeAtom);
    const isSplitMode = editorMode === "split";
    
    if (isSplitMode) {
        const left = leftWidth ?? 50;
        const right = 100 - left;
        return (
            <>
                <SkeletonPanel isSplitMode={true} isLeftPanel={true} width={left} />
                <SkeletonPanel isSplitMode={true} width={right} />
            </>
        );
    }

    return <SkeletonPanel />;
}
