import { Button } from "@/shared/ui/button";
import FullScreenCard from "@/shared/cards/FullScreenCard";
import { Link } from "@tanstack/react-router";

export default function NotFoundCard() {
  return (
    <FullScreenCard description="This page doesn't exist.">
      <Button
        className="w-full"
        nativeButton={false}
        render={<Link to="/{-$gistId}/{-$filePath}" params={{}} />}
      >
        Go home
      </Button>
    </FullScreenCard>
  );
}
