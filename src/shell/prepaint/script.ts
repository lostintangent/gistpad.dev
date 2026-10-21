import { prepaintWorkbench } from "../../features/workbench/layout/prepaint";
import { getSignInCallback, readSignInRedirect } from "../../features/account/sign-in-redirect";
import { githubToken } from "../../shared/github-token";

// Runs inline in the document head, before the shell is painted or the app starts.
const root = document.documentElement;
const callback = getSignInCallback(location.hash);
const href = callback ? readSignInRedirect() : location.hash.slice(1);
const url = new URL(href.startsWith("/") ? href : "/", location.href);
prepaintWorkbench(root, url);

let signedIn = callback === "access_token";
try {
  signedIn ||= !!githubToken.get();
} catch {
  // With storage unavailable, the auth client will decide whether a session is available.
}

root.dataset.startupPage = url.pathname.startsWith("/share/")
  ? "share"
  : signedIn
    ? "workbench"
    : "signin";
