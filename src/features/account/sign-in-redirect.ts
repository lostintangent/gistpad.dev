/** Shared by OAuth completion and the dependency-free first-paint layout script. */
export const AUTH_REDIRECT_KEY = "gistpad-auth-redirect";

export function getSignInCallback(hash: string) {
  return hash.match(/^#(access_token|error)=/)?.[1];
}

/** The recent app route to return to after OAuth (the home page otherwise). */
export function readSignInRedirect() {
  try {
    const { url, timestamp } = JSON.parse(sessionStorage.getItem(AUTH_REDIRECT_KEY) ?? "{}");
    if (typeof url !== "string" || typeof timestamp !== "number") return "/";
    if (Date.now() - timestamp >= 1000 * 60 * 5) return "/";
    const path = url.replace(/^#/, "");
    return path.startsWith("/") ? path : "/";
  } catch {
    return "/";
  }
}
