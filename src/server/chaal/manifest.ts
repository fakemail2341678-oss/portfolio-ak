import "@tanstack/react-start/server-only";
import { CHAAL_NAME } from "@/features/chaal/brand";
import { CHAAL_BASE } from "@/features/chaal/links";
import { m } from "@/paraglide/messages";
import { getTextDirection, type Locale, localizeHref } from "@/paraglide/runtime";

/**
 * Chaal's web app manifest in one language (/app/chaal/manifest.webmanifest and the /ne
 * one; the `_chaal` layout links it): installed, it opens on Chaal's home and stays inside
 * /app/chaal. Colours: the light theme's paper and ink (Chaal follows the device; a
 * manifest has one pair).
 */
export function chaalManifest(locale: Locale) {
	return {
		id: CHAAL_BASE,
		name: CHAAL_NAME,
		short_name: CHAAL_NAME,
		description: m.ch_description({}, { locale }),
		lang: locale,
		dir: getTextDirection(locale),
		start_url: localizeHref(CHAAL_BASE, { locale }),
		scope: localizeHref(CHAAL_BASE, { locale }),
		display: "standalone",
		background_color: "#f3f2ee",
		theme_color: "#f3f2ee",
		icons: [
			{ src: "/chaal/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/chaal/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/chaal/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/chaal/icon.svg", sizes: "any", type: "image/svg+xml" },
		],
	};
}
