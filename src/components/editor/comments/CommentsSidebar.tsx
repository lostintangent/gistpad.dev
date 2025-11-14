import { AgentFollowUp } from "@/agents/openai";
import { type ReviewComment } from "@/agents/qa/review";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type GistComment } from "@/lib/github";
import { Loader2 } from "lucide-react";
import AiComments from "./AiComments";
import UserComments from "./UserComments";

interface CommentsSidebarProps {
  comments: GistComment[];
  aiComments?: ReviewComment[];
  gistId: string;
  onCommentAdded: (comment: GistComment) => void;
  onCommentDeleted: (commentId: number) => void;
  onCommentUpdated: (comment: GistComment) => void;
  currentUser: string | null;
  isGistOwner: boolean;
  selectedCommentId: number | null;
  onCommentSelected: (commentId: number | null) => void;
  initialCommentValue: string;
  onAiCommentDeleted: (index: number) => void;
  onAcceptAiComment: (comment: ReviewComment, clarification?: string) => void;
  selectedTab: "user" | "ai" | null;
  onTabChange: (tab: "user" | "ai" | null) => void;
  isAiCommandInProgress: boolean;
  isAiReviewInProgress: boolean;
  aiCommentBeingApplied: number | null;
  activeAiRequestRequest: string;
  aiRequestTitle?: string | null;
  onClearAiComments?: () => void;
  appliedAiComments: number[];
  onRegenerateAiDiscussion?: (input?: string) => void;
  aiFollowUp?: AgentFollowUp | null;
  onFollowUp?: (topic: string) => void;
  /** Whether zen mode is active */
  isZenMode?: boolean;
  reasoningSummary?: string;
  isWebSearching?: boolean;
}

export default function CommentsSidebar({
  comments,
  aiComments = [],
  gistId,
  onCommentAdded,
  onCommentDeleted,
  onCommentUpdated,
  currentUser,
  isGistOwner = false,
  selectedCommentId = null,
  onCommentSelected,
  initialCommentValue = "",
  onAiCommentDeleted,
  onAcceptAiComment,
  selectedTab,
  onTabChange,
  isAiCommandInProgress = false,
  isAiReviewInProgress = false,
  aiCommentBeingApplied = null,
  activeAiRequestRequest = "",
  aiRequestTitle = null,
  onClearAiComments,
  appliedAiComments,
  onRegenerateAiDiscussion,
  aiFollowUp = null,
  onFollowUp,
  isZenMode = false,
  reasoningSummary,
  isWebSearching = false,
}: CommentsSidebarProps) {
  return (
    <div className="w-full h-full flex flex-col">
      {isZenMode && (aiComments.length > 0 || isAiReviewInProgress) ? (
        <div className="flex flex-col flex-1 min-h-0">
          <AiComments
            comments={aiComments}
            onCommentDeleted={onAiCommentDeleted}
            onAcceptComment={onAcceptAiComment}
            isCommandInProgress={isAiCommandInProgress}
            commentBeingApplied={aiCommentBeingApplied}
            reviewRequest={activeAiRequestRequest}
            reviewTitle={aiRequestTitle ?? undefined}
            isReviewInProgress={isAiReviewInProgress}
            appliedAiComments={appliedAiComments}
            onRegenerate={onRegenerateAiDiscussion}
            onClearComments={onClearAiComments}
            followUp={aiFollowUp}
            onFollowUp={onFollowUp}
            reasoningSummary={reasoningSummary}
            isWebSearching={isWebSearching}
          />
        </div>
      ) : aiComments.length > 0 || isAiReviewInProgress ? (
        <Tabs
          value={selectedTab || "user"}
          onValueChange={(value) => onTabChange?.(value as "user" | "ai")}
          className="flex-1 min-h-0 flex flex-col"
        >
          <TabsList className="border-b rounded-none h-11 px-4 justify-start gap-4 shrink-0">
            <TabsTrigger value="user" className="relative flex items-center">
              User Comments
              {comments.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {comments.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="relative flex items-center gap-2"
            >
              AI Comments
              {isAiReviewInProgress || aiCommentBeingApplied !== null ? (
                <Loader2
                  className={`h-4 w-4 animate-spin ${aiCommentBeingApplied !== null ? "text-green-500" : "text-primary"}`}
                />
              ) : (
                aiComments.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {aiComments.length}
                  </span>
                )
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="user"
            className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
          >
            <UserComments
              comments={comments}
              gistId={gistId}
              onCommentAdded={onCommentAdded}
              onCommentDeleted={onCommentDeleted}
              onCommentUpdated={onCommentUpdated}
              currentUser={currentUser}
              isGistOwner={isGistOwner}
              selectedCommentId={selectedCommentId}
              onCommentSelected={onCommentSelected}
              initialCommentValue={initialCommentValue}
            />
          </TabsContent>

          <TabsContent
            value="ai"
            className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
          >
            <AiComments
              comments={aiComments}
              onCommentDeleted={onAiCommentDeleted}
              onAcceptComment={onAcceptAiComment}
              isCommandInProgress={isAiCommandInProgress}
              commentBeingApplied={aiCommentBeingApplied}
              reviewRequest={activeAiRequestRequest}
              reviewTitle={aiRequestTitle ?? undefined}
              isReviewInProgress={isAiReviewInProgress}
              appliedAiComments={appliedAiComments}
              onRegenerate={onRegenerateAiDiscussion}
              onClearComments={onClearAiComments}
              followUp={aiFollowUp}
              onFollowUp={onFollowUp}
              reasoningSummary={reasoningSummary}
              isWebSearching={isWebSearching}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <UserComments
            comments={comments}
            gistId={gistId}
            onCommentAdded={onCommentAdded}
            onCommentDeleted={onCommentDeleted}
            onCommentUpdated={onCommentUpdated}
            currentUser={currentUser}
            isGistOwner={isGistOwner}
            selectedCommentId={selectedCommentId}
            onCommentSelected={onCommentSelected}
            initialCommentValue={initialCommentValue}
          />
        </div>
      )}
    </div>
  );
}
