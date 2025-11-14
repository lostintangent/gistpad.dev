import { useUserSession } from "@/hooks/useUserSession";
import { createGist, GistData } from "@/lib/github";
import LoadingCard from "@/pages/cards/LoadingCard";
import SignInCard from "@/pages/cards/SignInCard";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../index.css";

export default function New() {
    const { isLoggedIn, signin } = useUserSession();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();

    useEffect(() => {
        // Store the redirect URL for when the user signs in
        if (!isLoggedIn) {
            sessionStorage.setItem(
                "gistpad-auth-redirect",
                JSON.stringify({
                    url:
                        "/new" +
                        (searchParams.toString() ? `?${searchParams.toString()}` : ""),
                    timestamp: Date.now(),
                })
            );
            return;
        }

        const createNewGist = async () => {
            try {
                const description = searchParams.get("description") || "";
                const filename = searchParams.get("filename") || "README.md";
                const contents = searchParams.get("contents") || "\u{2064}";
                const isPublic = ["true", "1", "yes"].includes(
                    searchParams.get("public")?.toLowerCase() || ""
                );

                const newGist = await createGist(
                    description,
                    contents,
                    isPublic,
                    filename
                );

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
                navigate("/");
            }
        };

        createNewGist();
    }, [isLoggedIn, navigate, searchParams, queryClient]);

    return isLoggedIn ? (
        <LoadingCard message="Creating gist..." />
    ) : (
        <SignInCard onSignIn={signin} />
    );
}
