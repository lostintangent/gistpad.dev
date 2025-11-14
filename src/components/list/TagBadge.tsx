import { Badge } from "@/components/ui/badge";

function isLightColor(hex) {
    const rgb = parseInt(hex.replace("#", ""), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;

    // weighted perceived brightness
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128;
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
