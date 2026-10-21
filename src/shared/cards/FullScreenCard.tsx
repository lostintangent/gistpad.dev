import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

interface FullScreenCardProps {
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export default function FullScreenCard({ children, description, className }: FullScreenCardProps) {
  return (
    <div className="min-h-(--safe-screen-height) flex items-center justify-center">
      <Card className="w-84 bg-muted/30">
        <CardHeader>
          <CardTitle className="flex gap-2 items-center justify-center">
            <img src="/icon.svg" className="w-8" alt="" />
            <span>GistPad</span>
          </CardTitle>
          {description && <CardDescription className="text-center">{description}</CardDescription>}
        </CardHeader>
        <CardContent className={className}>{children}</CardContent>
      </Card>
    </div>
  );
}
