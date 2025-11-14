import { useUserSession } from "@/hooks/useUserSession";
import { createOrUpdateDailyNote, fetchUserGists, getTodayNoteFilename } from "@/lib/github";
import LoadingCard from "@/pages/cards/LoadingCard";
import SignInCard from "@/pages/cards/SignInCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "../index.css";

export default function Today() {
    const { isLoggedIn, signin } = useUserSession();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        // TODO: Remove the need for this, by having the
        // session hook properly set this redirect.
        if (!isLoggedIn) {
            sessionStorage.setItem(
                "gistpad-auth-redirect",
                JSON.stringify({
                    url: "/today",
                    timestamp: Date.now(),
                })
            );
        }
    }, [isLoggedIn]);

    const { data: { dailyNotes } = {}, isLoading } = useQuery({
        queryKey: ["gists"],
        queryFn: () => fetchUserGists(true),
        enabled: isLoggedIn
    });

    useEffect(() => {
        if (!isLoggedIn || isLoading) return;

        const openTodaysNote = async () => {
            try {
                // Get today's filename to check if it exists
                const filename = getTodayNoteFilename();

                // If we have daily notes, check if today's note exists
                if (dailyNotes && dailyNotes.files[filename]) {
                    navigate(`/${dailyNotes.id}/${filename}`);
                    return;
                }

                const updatedGist = await createOrUpdateDailyNote(
                    dailyNotes
                );

                queryClient.setQueryData(["gists"], (oldData: any) => ({
                    ...oldData,
                    dailyNotes: updatedGist,
                }));

                navigate(`/${updatedGist.id}/${filename}`);
            } catch (error) {
                console.error("Failed to open daily note:", error);
                navigate("/");
            }
        };

        openTodaysNote();
    }, [isLoggedIn, isLoading, queryClient]);

    return isLoggedIn ? (
        <LoadingCard message="Loading today's note..." />
    ) : (
        <SignInCard onSignIn={signin} />
    );
}
