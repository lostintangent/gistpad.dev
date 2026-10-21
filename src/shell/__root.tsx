import { createRootRoute, HeadContent, Outlet, ScriptOnce, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { usePreferences } from "@/features/account/queries";
import { GitHubError } from "@/shared/github";
import ErrorCard from "@/shared/cards/ErrorCard";
import NotFoundCard from "@/shared/cards/NotFoundCard";
import SignInPage from "@/features/account/SignInCard";
import { registerServiceWorker } from "./worker/register";

import "./styles.css";

declare const __PREPAINT_SCRIPT__: string;

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-startup-page="signin" suppressHydrationWarning>
      <head>
        {import.meta.env.SSR && <ScriptOnce>{__PREPAINT_SCRIPT__}</ScriptOnce>}
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Root() {
  const { accentColor } = usePreferences();

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentColor);
  }, [accentColor]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <>
      <Toaster theme="system" />
      <Outlet />
    </>
  );
}

export const Route = createRootRoute({
  shellComponent: Document,
  component: Root,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: "GistPad" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  notFoundComponent: NotFoundCard,
  errorComponent: (props) =>
    props.error instanceof GitHubError && props.error.status === 401 ? (
      <SignInPage />
    ) : (
      <ErrorCard {...props} />
    ),
});
