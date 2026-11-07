/**
 * Preload links for the font files needed on first paint.
 *
 * The `?url` imports resolve to the same hashed asset that app.css references,
 * so the browser reuses the preloaded response instead of fetching twice.
 * Only the subsets we render immediately are preloaded. Other unicode-range
 * subsets (latin-ext, cyrillic, ...) still load on demand.
 */
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import notoDevanagari from "@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2?url";
import type { Locale } from "@/paraglide/runtime";

type PreloadLink = {
	rel: "preload";
	href: string;
	as: "font";
	type: "font/woff2";
	crossOrigin: "anonymous";
};

const preload = (href: string): PreloadLink => ({
	rel: "preload",
	href,
	as: "font",
	type: "font/woff2",
	// Fonts are always fetched in CORS mode, so the preload must match or it is discarded.
	crossOrigin: "anonymous",
});

/**
 * Font preloads for a page in `locale`. Latin text appears on every page; the
 * Devanagari subset only renders first on Nepali pages (isolated Devanagari words
 * elsewhere use a system font, see the font-devanagari-system utility).
 *
 * Production only: in dev, Vite injects extra copies of the stylesheet, so the
 * browser re-requests the font instead of reusing the preload and warns about it.
 */
export const fontPreloads = (locale: Locale): PreloadLink[] => {
	if (import.meta.env.DEV) return [];
	return locale === "ne" ? [preload(interLatin), preload(notoDevanagari)] : [preload(interLatin)];
};
