import "@tanstack/react-start/server-only";
import { PARDA_NAME } from "@/features/parda/brand";
import { m } from "@/paraglide/messages";
import { getTextDirection, type Locale, localizeHref } from "@/paraglide/runtime";

/**
 * Parda's web app manifest in one language (/app/parda/manifest.webmanifest and the
 * /ne one; the `_parda` layout links it): installed, it opens on Parda's home and
 * stays inside /app/parda. Colours: the dark theme's ground and mask, Parda's default
 * scheme (decision 0232).
 */
export function pardaManifest(locale: Locale) {
	return {
		id: "/app/parda",
		name: PARDA_NAME,
		short_name: PARDA_NAME,
		description: m.pd_description({}, { locale }),
		lang: locale,
		dir: getTextDirection(locale),
		start_url: localizeHref("/app/parda", { locale }),
		scope: localizeHref("/app/parda", { locale }),
		display: "standalone",
		background_color: "#101013",
		theme_color: "#08080a",
		icons: [
			{ src: "/parda/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/parda/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/parda/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/parda/icon.svg", sizes: "any", type: "image/svg+xml" },
		],
	};
}
