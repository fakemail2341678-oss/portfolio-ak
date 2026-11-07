import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge with Graphite's type scale (src/styles/app.css) registered: out of the
 * box it can't tell that `text-title` is a size and `text-muted-foreground` a colour
 * (both are custom), and would keep only the last one.
 */
const twMerge = extendTailwindMerge({
	extend: { classGroups: { "font-size": [{ text: ["display", "title", "heading", "body", "caption"] }] } },
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
