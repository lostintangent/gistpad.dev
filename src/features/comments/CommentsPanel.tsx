import { CountBadge } from "@/shared/ui/count-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { ActiveFile } from "@/features/files/file";
import { useAgentReview, useRunningMode } from "@/features/agent/model/store";
import { commentsStore, updateComments } from "./store";
import { zenModeAtom } from "@/features/editor/layout";
import { useSelector } from "@tanstack/react-store";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import UserComments from "./UserComments";
import { useCommentThreads } from "./useCommentThreads";

// Reviews require the agent to be configured, so their comments are loaded on demand
const ReviewComments = lazy(() => import("@/features/agent/review/ReviewComments"));

/** The gist's comments, and the comments from an agent review of the file (when there is one). */
export default function CommentsPanel({ file }: { file: ActiveFile }) {
  const review = useAgentReview(file.key);
  const isReviewing = useRunningMode() === "review";
  const isZenMode = useSelector(zenModeAtom);
  const tab = useSelector(commentsStore, (state) => state.tab);
  const { comments } = useCommentThreads(file);

  const userComments = <UserComments file={file} />;
  const reviewComments = review && (
    <Suspense>
      <ReviewComments review={review} />
    </Suspense>
  );

  // In zen mode, an agent review replaces the user comments (rather than being tabbed)
  if (!review || isZenMode) {
    return <div className="flex flex-col h-full">{reviewComments || userComments}</div>;
  }

  return (
    <Tabs value={tab} onValueChange={(tab) => updateComments({ tab })} className="h-full gap-0">
      <TabsList
        variant="line"
        className="w-full h-11! px-4 justify-start gap-4 border-b rounded-none shrink-0"
      >
        <TabsTrigger value="user" className="flex-none">
          User Comments
          <CountBadge count={comments.length} />
        </TabsTrigger>
        <TabsTrigger value="agent" className="flex-none">
          Agent Comments
          {isReviewing || review.applyingCommentId !== null ? (
            <Loader2
              className={`animate-spin ${review.applyingCommentId !== null ? "text-green-500" : "text-primary"}`}
            />
          ) : (
            <CountBadge count={review.comments.length} />
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="user" className="min-h-0 flex flex-col">
        {userComments}
      </TabsContent>
      <TabsContent value="agent" className="min-h-0 flex flex-col">
        {reviewComments}
      </TabsContent>
    </Tabs>
  );
}
