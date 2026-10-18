import type { GitHubUser } from "@/shared/github";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import type { ComponentProps } from "react";

/** A GitHub user's avatar, which falls back to their initial (or "A", for anonymous comments). */
export function UserAvatar({
  user,
  ...props
}: { user: GitHubUser | null | undefined } & ComponentProps<typeof Avatar>) {
  return (
    <Avatar {...props}>
      <AvatarImage src={user?.avatar_url} alt={user?.login} />
      <AvatarFallback>{user?.login[0]?.toUpperCase() ?? "A"}</AvatarFallback>
    </Avatar>
  );
}
