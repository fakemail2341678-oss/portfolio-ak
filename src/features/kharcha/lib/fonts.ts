/**
 * Preloads for Kharcha's first paint (same approach as src/lib/fonts.ts): at most two per
 * locale, the display face and the text face of that locale's script. Laila 700 sets the
 * titles, the wordmark and hero amounts (decision 0281): Latin 18.9 kB, Devanagari 92.5 kB,
 * each under the bundle check's 150 kB budget. Production only: Vite's dev stylesheets
 * make the browser fetch fonts twice (decision 0026). The `_kharcha` layout adds these to
 * its head in Task 88.
 */
import lailaDevanagari from "@fontsource/laila/files/laila-devanagari-700-normal.woff2?url";
import lailaLatin from "@fontsource/laila/files/laila-latin-700-normal.woff2?url";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import notoDevanagari from "@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2?url";
import type { Locale } from "@/paraglide/runtime";

const preload = (href: string) =>
	({
		rel: "preload",
		href,
		as: "font",
		type: "font/woff2",
		crossOrigin: "anonymous",
	}) as const;

export const kharchaFontPreloads = (locale: Locale) => {
	if (import.meta.env.DEV) return [];
	return locale === "ne"
		? [preload(lailaDevanagari), preload(notoDevanagari)]
		: [preload(lailaLatin), preload(interLatin)];
};
