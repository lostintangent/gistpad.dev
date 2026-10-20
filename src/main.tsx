import { queryClient, restoreQueryCache } from "@/shared/query-client";
import { completeSignIn, isSignInRedirect } from "@/features/account/queries";
import { router } from "@/router";
import { createRoot } from "react-dom/client";
import FullScreenCard from "@/shared/cards/FullScreenCard";
import LoadingCard from "@/shared/cards/LoadingCard";
import { Button } from "@/shared/ui/button";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";

const root = createRoot(document.getElementById("root")!);

try {
  // Restore cached data before the first render, so that routes can use it immediately.
  await restoreQueryCache();

  // If the user is returning from GitHub's sign-in page, finish signing them in (which they're
  // shown, rather than a blank page), and then send them back to wherever they were in the app.
  if (isSignInRedirect()) root.render(<LoadingCard message="Signing in..." />);
  const redirectPath = await completeSignIn();
  if (redirectPath !== undefined) router.history.replace(redirectPath);
} catch (error) {
  // (Before the router's own error handling exists, so the failure is shown, not a blank page)
  root.render(
    <FullScreenCard description="GistPad couldn't start. Try reloading, and if the problem continues, please let us know.">
      <pre className="mb-4 max-h-40 overflow-auto text-xs text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </pre>
      <Button onClick={() => location.reload()} className="w-full">
        Reload
      </Button>
    </FullScreenCard>,
  );
  throw error;
}

root.render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster theme="system" />
      <RouterProvider router={router} />
    </TooltipProvider>
  </QueryClientProvider>,
);

// In production, a service worker caches the app's files, so it loads instantly on return visits.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
