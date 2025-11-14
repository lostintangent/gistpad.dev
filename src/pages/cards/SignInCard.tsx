import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import FullScreenCard from "./FullScreenCard";

export default function SignInCard({ onSignIn }: { onSignIn: () => Promise<void> }) {
  return (
    <FullScreenCard description="Manage and share your personal knowledge / daily notes using GitHub Gists.">
      <Button onClick={onSignIn} className="w-full gap-2">
        <Github className="h-4 w-4" />
        Sign in with GitHub
      </Button>
    </FullScreenCard>
  );
};