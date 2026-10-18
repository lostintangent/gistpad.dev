import { CountBadge } from "@/shared/ui/count-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { GistDocument } from "@/features/editor/document";
import { useAiReview, useRunningMode } from "@/features/ai/store";
import { commentsStore, updateComments } from "./store";
import { zenModeAtom } from "@/features/editor/layout";
import { useSelector } from "@tanstack/react-store";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import UserComments from "./UserComments";
import { useCommentThreads } from "./useCommentThreads";

// AI reviews require AI to be configured, so their comments are loaded on demand
const AiComments = lazy(() => import("@/features/ai/AiComments"));

/** The gist's comments, and the comments from an AI review of the document (when there is one). */
export default function CommentsPanel({ doc }: { doc: GistDocument }) {
  const review = useAiReview(doc.documentKey);
  const isReviewing = useRunningMode() === "review";
  const isZenMode = useSelector(zenModeAtom);
  const tab = useSelector(commentsStore, (state) => state.tab);
  const { comments } = useCommentThreads(doc);

  const userComments = <UserComments doc={doc} />;
  const aiComments = review && (
    <Suspense>
      <AiComments review={review} />
    </Suspense>
  );

  // In zen mode, an AI review replaces the user comments (rather than being tabbed)
  if (!review || isZenMode) {
    return <div className="flex flex-col h-full">{aiComments || userComments}</div>;
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
        <TabsTrigger value="ai" className="flex-none">
          AI Comments
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
      <TabsContent value="ai" className="min-h-0 flex flex-col">
        {aiComments}
      </TabsContent>
    </Tabs>
  );
}
