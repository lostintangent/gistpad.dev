import { useUserSession } from "@/hooks/useUserSession";
import { createGist, GistData } from "@/lib/github";
import LoadingCard from "@/pages/cards/LoadingCard";
import SignInCard from "@/pages/cards/SignInCard";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../index.css";

export default function New() {
  const { isLoggedIn, hasCachedSession, signin } = useUserSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    // If we don't have a cached session, store the redirect URL for after sign in
    if (!hasCachedSession) {
      sessionStorage.setItem(
        "gistpad-auth-redirect",
        JSON.stringify({
          url: "/new" + (searchParams.toString() ? `?${searchParams.toString()}` : ""),
          timestamp: Date.now(),
        }),
      );
      return;
    }

    // We have a cached session - try to create the gist optimistically
    const createNewGist = async () => {
      try {
        const description = searchParams.get("description") || "";
        const filename = searchParams.get("filename") || "README.md";
        const contents = searchParams.get("contents") || "\u{2064}";
        const isPublic = ["true", "1", "yes"].includes(
          searchParams.get("public")?.toLowerCase() || "",
        );

        const newGist = await createGist(description, contents, isPublic, filename);

        queryClient.setQueryData(["gists"], (oldData: GistData | undefined) => {
          if (!oldData) {
            return { gists: [newGist], starredGists: [], dailyNotes: null };
          }

          return {
            ...oldData,
            gists: [newGist, ...(oldData.gists || [])],
          };
        });

        if (filename === "README.md") {
          navigate(`/${newGist.id}`);
        } else {
          navigate(`/${newGist.id}/${filename}`);
        }
      } catch (error) {
        console.error("Failed to create new gist:", error);
        // If the API call failed, the token might be stale - show login
        setAuthFailed(true);
      }
    };

    createNewGist();
  }, [hasCachedSession, navigate, searchParams, queryClient]);

  // Show login if: no cached session, or session validation failed, or API call failed
  if ((!hasCachedSession && !isLoggedIn) || authFailed) {
    return <SignInCard onSignIn={signin} />;
  }

  return <LoadingCard message="Creating gist..." />;
}
