import type { SectionBrand } from "@/lib/section-brand";
import { NOINDEX } from "@/lib/seo";
import { localizeHref } from "@/paraglide/runtime";

/** The product's name in both languages: a brand, not a message (like Taskline's, decision 0208). */
export const PARDA_NAME = "Parda";

/** Title template inside Parda: "Page · Parda". */
export const pardaTitle = (page?: string): string => (page ? `${page} · ${PARDA_NAME}` : PARDA_NAME);

/** A private Parda page's head: its title and noindex (watch, library, sign-in and the rest, PLAN 12.5 "SEO"). */
export const pardaHead = (page?: string) => ({ meta: [{ title: pardaTitle(page) }, NOINDEX] });

/**
 * On the `_parda` layout (decision 0232): the root puts `data-section="parda"` on
 * <html>, which scopes "Masking" (src/styles/parda.css), resolves "system" to dark,
 * colours the browser's UI like the masks, and links these icons and the manifest.
 * The accent is never seen: Parda's stylesheet redefines `--primary` in both themes.
 */
export const PARDA_BRAND: SectionBrand = {
	id: "parda",
	accent: "amber",
	defaultScheme: "dark",
	themeColors: { light: "#d9d6ce", dark: "#08080a" },
	links: () => [
		{ rel: "icon", type: "image/svg+xml", href: "/parda/icon.svg" },
		{ rel: "icon", type: "image/png", sizes: "32x32", href: "/parda/favicon-32.png" },
		{ rel: "apple-touch-icon", href: "/parda/apple-touch-icon.png" },
		{ rel: "manifest", href: localizeHref("/app/parda/manifest.webmanifest") },
	],
};
