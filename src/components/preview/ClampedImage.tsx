import { Expand } from "lucide-react";
import { useState } from "react";

// Note: We use this cache to avoid images flickering in the 
// preview when the user is typing in split mode. In practice,
// an image won't commonly transition from short to tall, and so
// this ends up being a reasonable optimization that improves UX.
const tallImageCache = new Map<string, boolean>();

export function ClampedImage({ src, alt, onExpandImage, ...props }) {
    if (!src) {
        return null;
    }

    const [isTall, setIsTall] = useState(() => tallImageCache.get(src) || false);

    return (
        <div
            key={src}
            className="relative max-h-[500px] overflow-hidden group cursor-pointer"
            onClick={onExpandImage}
        >
            <img
                src={src}
                alt={alt}
                {...props}
                onLoad={(e) => {
                    if (e.currentTarget.offsetHeight > 500) {
                        tallImageCache.set(src, true);
                        setIsTall(true);
                    }
                }}
            />
            {isTall && (
                <>
                    {/* Gradient overlay */}
                    <div className="absolute left-0 bottom-0 w-full h-8 bg-linear-to-t from-background to-transparent pointer-events-none" />
                    {/* Expand button */}
                    <div className="absolute left-2 bottom-2 bg-background text-foreground px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-muted flex items-center">
                        <Expand className="h-3 w-3" />
                        <span className="group-hover:ml-2 whitespace-nowrap text-xs font-medium transition-all duration-100 ease-in-out opacity-0 translate-x-2 w-0 group-hover:opacity-100 group-hover:translate-x-0 group-hover:w-auto group-hover:block">
                            View full image
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
