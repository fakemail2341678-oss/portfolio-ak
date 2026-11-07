/**
 * Preloads for Chaal's first paint (same approach as src/lib/fonts.ts): at most two per
 * locale, the display face and the text face of that locale's script. Mukta 800 sets
 * the clocks, headings and wordmark (decision 0258): Latin 21 kB, Devanagari 101 kB,
 * each under the bundle check's 150 kB budget. Production only: Vite's dev stylesheets
 * make the browser fetch fonts twice (decision 0026). The `_chaal` layout adds these to
 * its head in Task 73.
 */
import muktaDevanagari from "@fontsource/mukta/files/mukta-devanagari-800-normal.woff2?url";
import muktaLatin from "@fontsource/mukta/files/mukta-latin-800-normal.woff2?url";
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

export const chaalFontPreloads = (locale: Locale) => {
	if (import.meta.env.DEV) return [];
	return locale === "ne"
		? [preload(muktaDevanagari), preload(notoDevanagari)]
		: [preload(muktaLatin), preload(interLatin)];
};
