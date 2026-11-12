import type { SectionBrand } from "@/lib/section-brand";
import { NOINDEX } from "@/lib/seo";
import { localizeHref } from "@/paraglide/runtime";

/** The product's name: a brand, the same in both languages (decision 0281; the wordmark adds "खर्च"). */
export const KHARCHA_NAME = "Kharcha";

/** Title template inside Kharcha: "Page · Kharcha". */
export const kharchaTitle = (page?: string): string => (page ? `${page} · ${KHARCHA_NAME}` : KHARCHA_NAME);

/** A private Kharcha page's head: its title and noindex (PLAN 14.5 "SEO": only the landing is indexable). */
export const kharchaHead = (page?: string) => ({ meta: [{ title: kharchaTitle(page) }, NOINDEX] });

/**
 * On the `_kharcha` layout (decision 0282): the root puts `data-section="kharcha"` on
 * <html>, which scopes "Bahi Khata" (src/styles/kharcha.css), colours the browser's UI
 * like the bookcloth, and links these icons and the manifest. The accent is never seen:
 * Kharcha's stylesheet redefines `--primary` in both themes.
 */
export const KHARCHA_BRAND: SectionBrand = {
	id: "kharcha",
	accent: "rose",
	themeColors: { light: "#9e1f1a", dark: "#6e1813" },
	links: () => [
		{ rel: "icon", type: "image/svg+xml", href: "/kharcha/icon.svg" },
		{ rel: "icon", type: "image/png", sizes: "32x32", href: "/kharcha/favicon-32.png" },
		{ rel: "apple-touch-icon", href: "/kharcha/apple-touch-icon.png" },
		{ rel: "manifest", href: localizeHref("/app/kharcha/manifest.webmanifest") },
	],
};
