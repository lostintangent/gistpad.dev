import FullScreenCard from "./FullScreenCard";

// This component is used for displaying a loading message for deep
// link pages when a long-running operation is in progress (e.g. /new and /today).
export default function LoadingCard({ message }: { message: string }) {
  return (
    <FullScreenCard className="flex justify-center animate-pulse">
      {message}
    </FullScreenCard>
  );
}
