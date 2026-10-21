import { createFileRoute, Outlet } from "@tanstack/react-router";
import { loadSession, useSession } from "@/features/account/queries";
import SignInPage from "../SignInCard";

export const Route = createFileRoute("/_authenticated")({
  loader: loadSession,
  component: function Authenticated() {
    return useSession().session ? <Outlet /> : <SignInPage />;
  },
});
