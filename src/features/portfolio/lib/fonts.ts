/**
 * Preloads for the portfolio's first paint (same approach as src/lib/fonts.ts):
 * the hero name is Eczar and the sentence under it is Inter, so those two files
 * are preloaded by the `_site` layout; Nepali pages add both faces' Devanagari
 * files. Every file is under the bundle check's 150 kB budget (Eczar Latin
 * 25.8 kB, Devanagari 85.8 kB). The `?url` imports resolve to the same hashed
 * files the stylesheets reference. Production only: Vite's dev stylesheets make
 * the browser fetch fonts twice (decision 0026).
 */
import eczarDevanagari from "@fontsource-variable/eczar/files/eczar-devanagari-wght-normal.woff2?url";
import eczarLatin from "@fontsource-variable/eczar/files/eczar-latin-wght-normal.woff2?url";
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

export const portfolioFontPreloads = (locale: Locale) => {
	if (import.meta.env.DEV) return [];
	const latin = [preload(eczarLatin), preload(interLatin)];
	return locale === "ne" ? [...latin, preload(eczarDevanagari), preload(notoDevanagari)] : latin;
};
