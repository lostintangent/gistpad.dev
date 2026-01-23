import { useUserSession } from "@/hooks/useUserSession";
import { createOrUpdateDailyNote, fetchUserGists, getTodayNoteFilename } from "@/lib/github";
import LoadingCard from "@/pages/cards/LoadingCard";
import SignInCard from "@/pages/cards/SignInCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../index.css";

export default function Today() {
  const { isLoggedIn, hasCachedSession, signin } = useUserSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    // If we don't have a cached session, store the redirect URL for after sign in
    if (!hasCachedSession) {
      sessionStorage.setItem(
        "gistpad-auth-redirect",
        JSON.stringify({
          url: "/today",
          timestamp: Date.now(),
        }),
      );
    }
  }, [hasCachedSession]);

  // Enable query if we have a cached session (optimistic)
  const {
    data: { dailyNotes } = {},
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["gists"],
    queryFn: () => fetchUserGists(true),
    enabled: hasCachedSession,
    retry: false, // Don't retry on auth failure
  });

  // If the query failed, the token might be stale
  useEffect(() => {
    if (isError) {
      setAuthFailed(true);
    }
  }, [isError]);

  useEffect(() => {
    if (!hasCachedSession || isLoading || isError) return;

    const openTodaysNote = async () => {
      try {
        // Get today's filename to check if it exists
        const filename = getTodayNoteFilename();

        // If we have daily notes, check if today's note exists
        if (dailyNotes && dailyNotes.files[filename]) {
          navigate(`/${dailyNotes.id}/${filename}`);
          return;
        }

        const updatedGist = await createOrUpdateDailyNote(dailyNotes);

        queryClient.setQueryData(["gists"], (oldData: any) => ({
          ...oldData,
          dailyNotes: updatedGist,
        }));

        navigate(`/${updatedGist.id}/${filename}`);
      } catch (error) {
        console.error("Failed to open daily note:", error);
        setAuthFailed(true);
      }
    };

    openTodaysNote();
  }, [hasCachedSession, isLoading, isError, dailyNotes, queryClient, navigate]);

  // Show login if: no cached session, or session validation failed, or API call failed
  if ((!hasCachedSession && !isLoggedIn) || authFailed) {
    return <SignInCard onSignIn={signin} />;
  }

  return <LoadingCard message="Loading today's note..." />;
}
