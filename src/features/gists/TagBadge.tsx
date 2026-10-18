import { Badge } from "@/shared/ui/badge";

/** Whether a tag's color is light (and so, needs black text, rather than white, to be legible). */
export function isLightColor(hex: string) {
  const rgb = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [16, 8, 0].map((shift) => (rgb >> shift) & 0xff);

  // Weighted perceived brightness (YIQ)
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
}

interface TagBadgeProps {
  tag: string;
  color: string;
  count?: number;
}

export default function TagBadge({ tag, color, count }: TagBadgeProps) {
  return (
    <Badge
      style={{ backgroundColor: color }}
      className={`relative text-xs ${isLightColor(color) ? "text-black" : "text-white"}`}
    >
      <span className="block flex-1 truncate min-w-0">{tag}</span>
      {typeof count === "number" && (
        <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white text-black w-3.5 h-3.5 text-[9px]">
          {count}
        </span>
      )}
    </Badge>
  );
}
