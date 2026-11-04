import type { Command } from "@/features/commands/command";
import { useRouter } from "@tanstack/react-router";
import { ExternalLink, FileText, Fullscreen, Link } from "lucide-react";
import { toast } from "sonner";
import { readFileContent, type ActiveFile } from "./file";

export function useActiveFileCommands(file: ActiveFile, disabled: boolean) {
  const router = useRouter();

  return {
    copyUrl: {
      id: `file.copyUrl:${file.key}`,
      group: "This gist",
      title: "Copy URL",
      icon: Link,
      disabled,
      agent: "Copy the document's URL to the clipboard.",
      run: async () => {
        await navigator.clipboard.writeText(location.href);
        toast.success("URL copied to clipboard!");
      },
    } satisfies Command,
    copyHtml: {
      id: `file.copyHtml:${file.key}`,
      group: "This gist",
      title: "Copy as HTML",
      icon: FileText,
      disabled,
      agent: "Copy the document to the clipboard as HTML.",
      run: async () => {
        const { copyAsHtml } = await import("@/features/markdown/toHtml");
        await copyAsHtml(readFileContent(file));
        toast.success("HTML copied to clipboard!");
      },
    } satisfies Command,
    fullscreen: {
      id: `file.fullscreen:${file.key}`,
      group: "This gist",
      title: "View fullscreen",
      icon: Fullscreen,
      disabled,
      agent: "Show the rendered document fullscreen (its share page).",
      run: () =>
        router.navigate({
          to: "/share/$gistId/{-$filePath}",
          params: { gistId: file.gistId!, filePath: file.filename },
        }),
    } satisfies Command,
    github: {
      id: `file.github:${file.key}`,
      group: "This gist",
      title: "Open in GitHub",
      icon: ExternalLink,
      disabled,
      agent: "Open the gist on GitHub, in a new tab.",
      run: () => {
        const anchor = file.isReadme ? "" : `#file-${file.filename.replace(/\./g, "-")}`;
        window.open(`https://gist.github.com/${file.gistId}${anchor}`, "_blank");
      },
    } satisfies Command,
  };
}
