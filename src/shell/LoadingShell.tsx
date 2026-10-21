import { useLocation, useRouter } from "@tanstack/react-router";
import { useSession } from "@/features/account/queries";
import { Suspense, use } from "react";
import { browser } from "react-dom";
import SignInPage from "@/features/account/SignInCard";
import { WorkbenchPage } from "@/features/workbench/routes";
import { SharePage } from "@/features/share/routes";

const pages = { signin: SignInPage, workbench: WorkbenchPage, share: SharePage };

function ShellContent() {
  const isInitial = useRouter().isShell();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { session } = useSession();
  // The prepaint hint stands in for a session until authentication resolves.
  let page: keyof typeof pages | undefined;
  if (typeof window !== "undefined") {
    const initialPage = document.documentElement.dataset.startupPage;
    if (pathname.startsWith("/share/")) page = "share";
    else
      page =
        session || (session === undefined && initialPage !== "signin") ? "workbench" : "signin";
  }
  return (
    <>
      <main data-initial-shell={isInitial ? "" : undefined} inert>
        {Object.entries(pages).map(([name, Page]) =>
          !page || page === name ? (
            <div key={name} data-shell-page={name}>
              <Page />
            </div>
          ) : null,
        )}
      </main>
      <p className="sr-only" role="status">
        Loading GistPad…
      </p>
    </>
  );
}

function BrowserShell() {
  use(browser());
  return <ShellContent />;
}

export default function LoadingShell() {
  return (
    <Suspense fallback={<ShellContent />}>
      <BrowserShell />
    </Suspense>
  );
}
