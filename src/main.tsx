import { restoreQueryCache } from "@/shared/query-client";
import { completeSignIn } from "@/features/session/queries";
import { router } from "@/router";
import { createRoot } from "react-dom/client";
import App from "@/App";

// Restore cached data before the first render, so that routes can use it immediately.
await restoreQueryCache();

// If the user is returning from GitHub's sign-in page, finish signing them in,
// and then send them back to wherever they were in the app.
const redirectPath = await completeSignIn();
if (redirectPath !== undefined) {
  router.history.replace(redirectPath);
}

createRoot(document.getElementById("root")!).render(<App />);

// In production, a service worker caches the app's files, so it loads instantly on return visits.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
