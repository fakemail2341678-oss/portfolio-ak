/**
 * Preloads for Parda's first paint (same approach as src/lib/fonts.ts): at most two
 * per locale, the display face and the text face of that locale's script. Latin
 * titles on a Nepali page load on demand, since TMDB's text falls back to English.
 * Each file is under the bundle check's 150 kB budget (Latin 114 kB, Devanagari
 * 95 kB; decision 0232). Production only: Vite's dev stylesheets make the browser
 * fetch fonts twice (decision 0026).
 */
import anekDevanagari from "@fontsource/anek-devanagari/files/anek-devanagari-devanagari-700-normal.woff2?url";
import anekLatin from "@fontsource-variable/anek-devanagari/files/anek-devanagari-latin-wdth-normal.woff2?url";
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

export const pardaFontPreloads = (locale: Locale) => {
	if (import.meta.env.DEV) return [];
	return locale === "ne"
		? [preload(anekDevanagari), preload(notoDevanagari)]
		: [preload(anekLatin), preload(interLatin)];
};
