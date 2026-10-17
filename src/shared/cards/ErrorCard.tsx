import { Button } from "@/shared/ui/button";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import FullScreenCard from "@/shared/cards/FullScreenCard";

export default function ErrorCard({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <FullScreenCard description="Something went wrong. Try reloading, and if the problem continues, please let us know.">
      <pre className="mb-4 max-h-40 overflow-auto text-xs text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </pre>
      {/* (Invalidating the router reloads its data, and resets the error) */}
      <Button onClick={() => router.invalidate()} className="w-full">
        Try again
      </Button>
    </FullScreenCard>
  );
}
