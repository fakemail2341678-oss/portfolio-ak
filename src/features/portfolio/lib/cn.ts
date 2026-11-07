import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` for portfolio components. tailwind-merge can't tell that `text-hm-head`
 * is a font size and `text-hm-accent` a colour (both are custom), so out of
 * the box it keeps only the last one. Registering the scale fixes that, scoped
 * to the portfolio so the app's `cn` (src/lib/utils.ts) is unchanged.
 */
const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			"font-size": [{ text: ["hm-small", "hm-body", "hm-lead", "hm-head", "hm-title"] }],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
