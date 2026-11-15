import type { SectionBrand } from "@/lib/section-brand";
import { NOINDEX } from "@/lib/seo";
import { localizeHref } from "@/paraglide/runtime";

/**
 * The product's name in both languages: a brand, not a message (like Taskline's and
 * Parda's, decision 0208). "Chaal" (चाल) is "a move"; it's a working name (PLAN 13.2).
 * The wordmark adds the Devanagari beside it.
 */
export const CHAAL_NAME = "Chaal";
export const CHAAL_NAME_NE = "चाल";

/** Title template inside Chaal: "Page · Chaal". */
export const chaalTitle = (page?: string): string => (page ? `${page} · ${CHAAL_NAME}` : CHAAL_NAME);

/** A private Chaal page's head: its title and noindex (settings, sign-in and the rest, PLAN 13.5 "SEO"). */
export const chaalHead = (page?: string) => ({ meta: [{ title: chaalTitle(page) }, NOINDEX] });

/**
 * On the `_chaal` layout (decisions 0258 and 0259): the root puts `data-section="chaal"`
 * on <html>, which scopes "Diagram" (src/styles/chaal.css); "system" follows the device,
 * the browser's UI takes the paper and the ink-black ground, and these icons and the
 * manifest replace the app's. The accent is never seen: chaal.css redefines `--primary`.
 */
export const CHAAL_BRAND: SectionBrand = {
	id: "chaal",
	accent: "indigo",
	themeColors: { light: "#f3f2ee", dark: "#121211" },
	links: () => [
		{ rel: "icon", type: "image/svg+xml", href: "/chaal/icon.svg" },
		{ rel: "icon", type: "image/png", sizes: "32x32", href: "/chaal/favicon-32.png" },
		{ rel: "apple-touch-icon", href: "/chaal/apple-touch-icon.png" },
		{ rel: "manifest", href: localizeHref("/app/chaal/manifest.webmanifest") },
	],
};
